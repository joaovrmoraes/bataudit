package audit

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

// QueryResult is the generic shape returned by the SQL Query Console.
type QueryResult struct {
	Columns   []string `json:"columns"`
	Rows      [][]any  `json:"rows"`
	RowCount  int      `json:"row_count"`
	ElapsedMs int64    `json:"elapsed_ms"`
	Truncated bool     `json:"truncated"`
}

const (
	defaultMaxRows  = 1000
	defaultTimeout  = 5 * time.Second
	readOnlyEnforce = "SET LOCAL statement_timeout = %d"
)

var hasLimit = regexp.MustCompile(`(?i)\blimit\s+\d+`)

// ValidateQuery enforces a single read-only SELECT. Returns a cleaned statement.
//
// Note: it intentionally does NOT blacklist keywords like DELETE/UPDATE/CREATE —
// those are common *values* in audit logs (`method = 'DELETE'`, `action = 'create'`),
// so a keyword blacklist would reject legitimate queries. The real guarantee is
// the database itself: queries run on a read-only role inside a READ ONLY
// transaction, so any write (including a data-modifying CTE) is rejected by
// PostgreSQL, not by string matching.
func ValidateQuery(raw string) (string, error) {
	q := strings.TrimSpace(raw)
	q = strings.TrimRight(q, "; \t\r\n")
	if q == "" {
		return "", errors.New("empty query")
	}
	// Single statement only — no stacked queries.
	if strings.Contains(q, ";") {
		return "", errors.New("only a single statement is allowed (remove ';')")
	}
	// Must start as a read query.
	lower := strings.ToLower(q)
	if !strings.HasPrefix(lower, "select") && !strings.HasPrefix(lower, "with") {
		return "", errors.New("only SELECT queries are allowed")
	}
	return q, nil
}

// enforceLimit appends a LIMIT if the query doesn't already have one, so a
// `SELECT *` can't flood the client. Best-effort — the row scan also caps.
func enforceLimit(q string, max int) string {
	if hasLimit.MatchString(q) {
		return q
	}
	return fmt.Sprintf("%s LIMIT %d", q, max)
}

// RunQuery executes a validated SELECT inside a READ ONLY transaction with a
// statement timeout, and returns generic columns/rows.
//
// Two database-enforced guards run here, both inside one transaction that is
// always rolled back:
//   - BeginTx(ReadOnly) — PostgreSQL rejects ANY write (INSERT/UPDATE/DELETE,
//     DDL, data-modifying CTEs) with "cannot execute X in a read-only
//     transaction". This is the guarantee against destructive queries.
//   - SET LOCAL ROLE bataudit_readonly — when the read-only role exists, the
//     query can only read the audit tables it was granted. Best-effort: if the
//     role isn't provisioned, the write protection above still applies.
func RunQuery(ctx context.Context, db *gorm.DB, raw string) (*QueryResult, error) {
	q, err := ValidateQuery(raw)
	if err != nil {
		return nil, err
	}
	q = enforceLimit(q, defaultMaxRows)

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("db handle: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, defaultTimeout+time.Second)
	defer cancel()

	tx, err := sqlDB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, fmt.Errorf("begin read-only tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Postgres-enforced statement timeout (ignored harmlessly elsewhere).
	_, _ = tx.ExecContext(ctx, fmt.Sprintf(readOnlyEnforce, defaultTimeout.Milliseconds()))
	// Drop to the read-only role for table-level scoping when it exists. Guarded
	// by a savepoint: on PostgreSQL a failed statement aborts the whole
	// transaction, so if the role isn't provisioned we roll back just this step
	// and continue — writes are still blocked by the READ ONLY transaction.
	if _, err := tx.ExecContext(ctx, "SAVEPOINT bat_ro"); err == nil {
		if _, err := tx.ExecContext(ctx, "SET LOCAL ROLE bataudit_readonly"); err != nil {
			_, _ = tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT bat_ro")
		} else {
			_, _ = tx.ExecContext(ctx, "RELEASE SAVEPOINT bat_ro")
		}
	}

	start := time.Now()
	rows, err := tx.QueryContext(ctx, q)
	if err != nil {
		return nil, friendlyDBError(err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	result := &QueryResult{Columns: cols, Rows: [][]any{}}
	for rows.Next() {
		if len(result.Rows) >= defaultMaxRows {
			result.Truncated = true
			break
		}
		scan := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range scan {
			ptrs[i] = &scan[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		for i, v := range scan {
			scan[i] = normalizeValue(v)
		}
		result.Rows = append(result.Rows, scan)
	}
	if err := rows.Err(); err != nil {
		return nil, friendlyDBError(err)
	}

	result.RowCount = len(result.Rows)
	result.ElapsedMs = time.Since(start).Milliseconds()
	return result, nil
}

// normalizeValue makes driver values JSON-friendly (e.g. []byte -> string).
func normalizeValue(v any) any {
	switch t := v.(type) {
	case []byte:
		return string(t)
	case time.Time:
		return t.Format(time.RFC3339)
	default:
		return v
	}
}

func friendlyDBError(err error) error {
	msg := err.Error()
	// Surface read-only / permission rejections clearly.
	if strings.Contains(msg, "read-only") || strings.Contains(msg, "permission denied") {
		return fmt.Errorf("query rejected: %s", msg)
	}
	return fmt.Errorf("query error: %s", msg)
}
