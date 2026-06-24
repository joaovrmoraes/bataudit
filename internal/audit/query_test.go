package audit

import (
	"strings"
	"testing"
)

func TestValidateQuery_AcceptsSelect(t *testing.T) {
	for _, q := range []string{
		"SELECT * FROM audits",
		"  select id, path from audits where status_code >= 500  ",
		"WITH t AS (SELECT * FROM audits) SELECT * FROM t",
		"SELECT * FROM audits WHERE method = 'DELETE'",       // DELETE as a value must pass
		"SELECT * FROM audits WHERE path LIKE '%update%'",    // update as a value must pass
		"SELECT count(*) FROM audits WHERE path = '/create'", // create as a value must pass
	} {
		if _, err := ValidateQuery(q); err != nil {
			t.Errorf("expected %q to be valid, got: %v", q, err)
		}
	}
}

func TestValidateQuery_RejectsNonSelect(t *testing.T) {
	for _, q := range []string{
		"INSERT INTO audits (id) VALUES ('x')",
		"UPDATE audits SET path = '/x'",
		"DELETE FROM audits",
		"DROP TABLE audits",
		"TRUNCATE audits",
	} {
		if _, err := ValidateQuery(q); err == nil {
			t.Errorf("expected %q to be rejected", q)
		}
	}
}

func TestValidateQuery_RejectsStackedStatements(t *testing.T) {
	q := "SELECT * FROM audits; DELETE FROM audits"
	if _, err := ValidateQuery(q); err == nil {
		t.Error("expected stacked statements to be rejected")
	}
}

func TestValidateQuery_RejectsEmpty(t *testing.T) {
	if _, err := ValidateQuery("   "); err == nil {
		t.Error("expected empty query to be rejected")
	}
}

func TestEnforceLimit(t *testing.T) {
	got := enforceLimit("SELECT * FROM audits", 1000)
	if !strings.Contains(strings.ToLower(got), "limit 1000") {
		t.Errorf("expected LIMIT appended, got %q", got)
	}
	// Existing LIMIT is preserved (not doubled).
	got = enforceLimit("SELECT * FROM audits LIMIT 5", 1000)
	if strings.Count(strings.ToLower(got), "limit") != 1 {
		t.Errorf("expected single LIMIT, got %q", got)
	}
}
