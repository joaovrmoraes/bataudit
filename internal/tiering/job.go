package tiering

import (
	"context"
	"log/slog"
	"strconv"
	"time"
)

// Job runs the data tiering aggregation.
type Job struct {
	repo        Repository
	rawDays     int // aggregate raw events older than this many days
	hourlyDays  int // aggregate hourly summaries older than this many days
}

func NewJob(repo Repository, rawDays, hourlyDays int) *Job {
	return &Job{repo: repo, rawDays: rawDays, hourlyDays: hourlyDays}
}

// Run executes one full tiering cycle: raw→hourly, then hourly→daily.
func (j *Job) Run(ctx context.Context) {
	slog.Info("tiering: starting aggregation cycle",
		"raw_days", j.rawDays, "hourly_days", j.hourlyDays)

	rawCutoff := time.Now().UTC().AddDate(0, 0, -j.rawDays)
	n, err := j.repo.AggregateRawToHourly(rawCutoff)
	if err != nil {
		slog.Error("tiering: raw→hourly aggregation failed", "error", err)
	} else {
		slog.Info("tiering: raw→hourly complete", "events_deleted", n)
	}

	if ctx.Err() != nil {
		return
	}

	hourlyCutoff := time.Now().UTC().AddDate(0, 0, -j.hourlyDays)
	n, err = j.repo.AggregateHourlyToDaily(hourlyCutoff)
	if err != nil {
		slog.Error("tiering: hourly→daily aggregation failed", "error", err)
	} else {
		slog.Info("tiering: hourly→daily complete", "summaries_deleted", n)
	}
}

// Scheduler runs the tiering Job once per day at the configured hour (UTC).
type Scheduler struct {
	job  *Job
	hour int // UTC hour to run (0-23)
}

func NewScheduler(job *Job, runHour int) *Scheduler {
	return &Scheduler{job: job, hour: runHour}
}

// NewSchedulerFromEnv creates a Scheduler reading TIERING_HOUR (default "2"),
// TIERING_RAW_DAYS (default "30"), TIERING_HOURLY_DAYS (default "365").
func NewSchedulerFromEnv(repo Repository, getEnv func(string, string) string) *Scheduler {
	rawDays := parseIntEnv(getEnv("TIERING_RAW_DAYS", "30"), 30)
	hourlyDays := parseIntEnv(getEnv("TIERING_HOURLY_DAYS", "365"), 365)
	hour := parseIntEnv(getEnv("TIERING_HOUR", "2"), 2)

	job := NewJob(repo, rawDays, hourlyDays)
	return NewScheduler(job, hour)
}

// Start blocks until ctx is cancelled, running the job once per day at the
// configured hour.
func (s *Scheduler) Start(ctx context.Context) {
	for {
		next := s.nextRun()
		slog.Info("tiering: next run scheduled", "at", next.Format(time.RFC3339))

		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Until(next)):
			s.job.Run(ctx)
		}
	}
}

func (s *Scheduler) nextRun() time.Time {
	now := time.Now().UTC()
	candidate := time.Date(now.Year(), now.Month(), now.Day(), s.hour, 0, 0, 0, time.UTC)
	if !candidate.After(now) {
		candidate = candidate.Add(24 * time.Hour)
	}
	return candidate
}

func parseIntEnv(v string, defaultVal int) int {
	if n, err := strconv.Atoi(v); err == nil && n > 0 {
		return n
	}
	return defaultVal
}
