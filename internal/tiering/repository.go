package tiering

import (
	"time"

	"gorm.io/gorm"
)

type Repository interface {
	// AggregateRawToHourly aggregates raw events older than cutoff into hourly
	// summaries and deletes the source rows. Returns count of events processed.
	AggregateRawToHourly(cutoff time.Time) (int64, error)

	// AggregateHourlyToDaily aggregates hourly summaries older than cutoff into
	// daily summaries and deletes the source hourly rows.
	AggregateHourlyToDaily(cutoff time.Time) (int64, error)

	// GetHistory returns merged time-series data for a project spanning both raw
	// events and pre-aggregated summaries.
	GetHistory(projectID string, from, to time.Time) ([]HistoryPoint, error)

	// GetUsage returns row counts for a project across all tiers.
	GetUsage(projectID string) (UsageStat, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) AggregateRawToHourly(cutoff time.Time) (int64, error) {
	// Insert hourly summaries from raw events, skipping already-aggregated buckets.
	ins := r.db.Exec(`
		INSERT INTO audit_summaries
			(period_start, period_type, project_id, service_name,
			 status_2xx, status_3xx, status_4xx, status_5xx,
			 avg_ms, p95_ms, event_count)
		SELECT
			date_trunc('hour', timestamp)                                                          AS period_start,
			'hour'                                                                                 AS period_type,
			project_id,
			service_name,
			COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)                      AS status_2xx,
			COUNT(*) FILTER (WHERE status_code >= 300 AND status_code < 400)                      AS status_3xx,
			COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500)                      AS status_4xx,
			COUNT(*) FILTER (WHERE status_code >= 500)                                            AS status_5xx,
			COALESCE(AVG(response_time), 0)                                                       AS avg_ms,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time), 0)              AS p95_ms,
			COUNT(*)                                                                               AS event_count
		FROM audits
		WHERE timestamp < ?
		  AND event_type = 'http'
		  AND project_id IS NOT NULL
		  AND project_id != ''
		GROUP BY date_trunc('hour', timestamp), project_id, service_name
		ON CONFLICT (period_start, period_type, project_id, service_name) DO NOTHING
	`, cutoff)
	if ins.Error != nil {
		return 0, ins.Error
	}

	// Delete the raw events that were just aggregated.
	del := r.db.Exec(`
		DELETE FROM audits
		WHERE timestamp < ?
		  AND event_type = 'http'
		  AND project_id IS NOT NULL
		  AND project_id != ''
	`, cutoff)
	return del.RowsAffected, del.Error
}

func (r *repository) AggregateHourlyToDaily(cutoff time.Time) (int64, error) {
	ins := r.db.Exec(`
		INSERT INTO audit_summaries
			(period_start, period_type, project_id, service_name,
			 status_2xx, status_3xx, status_4xx, status_5xx,
			 avg_ms, p95_ms, event_count)
		SELECT
			date_trunc('day', period_start)           AS period_start,
			'day'                                     AS period_type,
			project_id,
			service_name,
			SUM(status_2xx)                           AS status_2xx,
			SUM(status_3xx)                           AS status_3xx,
			SUM(status_4xx)                           AS status_4xx,
			SUM(status_5xx)                           AS status_5xx,
			SUM(avg_ms * event_count) / NULLIF(SUM(event_count), 0) AS avg_ms,
			MAX(p95_ms)                               AS p95_ms,
			SUM(event_count)                          AS event_count
		FROM audit_summaries
		WHERE period_type = 'hour'
		  AND period_start < ?
		GROUP BY date_trunc('day', period_start), project_id, service_name
		ON CONFLICT (period_start, period_type, project_id, service_name) DO NOTHING
	`, cutoff)
	if ins.Error != nil {
		return 0, ins.Error
	}

	del := r.db.Exec(`
		DELETE FROM audit_summaries
		WHERE period_type = 'hour'
		  AND period_start < ?
	`, cutoff)
	return del.RowsAffected, del.Error
}

func (r *repository) GetHistory(projectID string, from, to time.Time) ([]HistoryPoint, error) {
	// Query pre-aggregated summaries in range.
	var summaries []struct {
		PeriodStart time.Time  `gorm:"column:period_start"`
		PeriodType  PeriodType `gorm:"column:period_type"`
		EventCount  int64      `gorm:"column:event_count"`
		Status4xx   int64      `gorm:"column:status_4xx"`
		Status5xx   int64      `gorm:"column:status_5xx"`
		AvgMs       float64    `gorm:"column:avg_ms"`
		P95Ms       float64    `gorm:"column:p95_ms"`
	}
	err := r.db.Raw(`
		SELECT
			period_start,
			period_type,
			SUM(event_count)  AS event_count,
			SUM(status_4xx)   AS status_4xx,
			SUM(status_5xx)   AS status_5xx,
			SUM(avg_ms * event_count) / NULLIF(SUM(event_count), 0) AS avg_ms,
			MAX(p95_ms)       AS p95_ms
		FROM audit_summaries
		WHERE project_id = ?
		  AND period_start >= ?
		  AND period_start < ?
		GROUP BY period_start, period_type
		ORDER BY period_start ASC
	`, projectID, from, to).Scan(&summaries).Error
	if err != nil {
		return nil, err
	}

	// Query raw events in range, bucketed by hour.
	var raw []struct {
		PeriodStart time.Time `gorm:"column:period_start"`
		EventCount  int64     `gorm:"column:event_count"`
		Status4xx   int64     `gorm:"column:status_4xx"`
		Status5xx   int64     `gorm:"column:status_5xx"`
		AvgMs       float64   `gorm:"column:avg_ms"`
		P95Ms       float64   `gorm:"column:p95_ms"`
	}
	err = r.db.Raw(`
		SELECT
			date_trunc('hour', timestamp)                                             AS period_start,
			COUNT(*)                                                                  AS event_count,
			COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500)         AS status_4xx,
			COUNT(*) FILTER (WHERE status_code >= 500)                               AS status_5xx,
			COALESCE(AVG(response_time), 0)                                           AS avg_ms,
			COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time), 0) AS p95_ms
		FROM audits
		WHERE project_id = ?
		  AND event_type = 'http'
		  AND timestamp >= ?
		  AND timestamp < ?
		GROUP BY date_trunc('hour', timestamp)
		ORDER BY period_start ASC
	`, projectID, from, to).Scan(&raw).Error
	if err != nil {
		return nil, err
	}

	// Merge: summaries first, then raw (de-duplcate by period_start).
	seen := make(map[time.Time]bool)
	points := make([]HistoryPoint, 0, len(summaries)+len(raw))

	for _, s := range summaries {
		seen[s.PeriodStart] = true
		points = append(points, HistoryPoint{
			PeriodStart: s.PeriodStart,
			PeriodType:  s.PeriodType,
			EventCount:  s.EventCount,
			Errors4xx:   s.Status4xx,
			Errors5xx:   s.Status5xx,
			AvgMs:       s.AvgMs,
			P95Ms:       s.P95Ms,
		})
	}
	for _, r := range raw {
		if seen[r.PeriodStart] {
			continue
		}
		points = append(points, HistoryPoint{
			PeriodStart: r.PeriodStart,
			PeriodType:  PeriodHour,
			EventCount:  r.EventCount,
			Errors4xx:   r.Status4xx,
			Errors5xx:   r.Status5xx,
			AvgMs:       r.AvgMs,
			P95Ms:       r.P95Ms,
		})
	}

	// Sort by period_start ascending.
	sortHistoryPoints(points)
	return points, nil
}

func (r *repository) GetUsage(projectID string) (UsageStat, error) {
	var stat UsageStat

	r.db.Raw(`SELECT COUNT(*) FROM audits WHERE project_id = ?`, projectID).Scan(&stat.RawEvents)
	r.db.Raw(`SELECT COUNT(*) FROM audit_summaries WHERE project_id = ? AND period_type = 'hour'`, projectID).Scan(&stat.HourlySummaries)
	r.db.Raw(`SELECT COUNT(*) FROM audit_summaries WHERE project_id = ? AND period_type = 'day'`, projectID).Scan(&stat.DailySummaries)

	return stat, nil
}

// sortHistoryPoints sorts in-place by PeriodStart ascending.
func sortHistoryPoints(pts []HistoryPoint) {
	for i := 1; i < len(pts); i++ {
		for j := i; j > 0 && pts[j].PeriodStart.Before(pts[j-1].PeriodStart); j-- {
			pts[j], pts[j-1] = pts[j-1], pts[j]
		}
	}
}
