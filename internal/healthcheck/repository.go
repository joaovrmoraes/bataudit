package healthcheck

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	ListByProject(projectID string) ([]Monitor, error)
	ListAllEnabled() ([]Monitor, error)
	GetByID(id string) (*Monitor, error)
	CountByProject(projectID string) (int64, error)
	Create(m *Monitor) error
	Update(m *Monitor) error
	Delete(id string) error
	UpdateStatus(id string, status MonitorStatus, checkedAt time.Time) error
	SaveResult(r *Result) error
	ListResults(monitorID string, limit int) ([]Result, error)
	PruneResults(monitorID string, keep int) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListByProject(projectID string) ([]Monitor, error) {
	var monitors []Monitor
	err := r.db.Where("project_id = ?", projectID).Order("created_at ASC").Find(&monitors).Error
	return monitors, err
}

func (r *repository) ListAllEnabled() ([]Monitor, error) {
	var monitors []Monitor
	err := r.db.Where("enabled = true").Find(&monitors).Error
	return monitors, err
}

func (r *repository) GetByID(id string) (*Monitor, error) {
	var m Monitor
	err := r.db.Where("id = ?", id).First(&m).Error
	return &m, err
}

func (r *repository) CountByProject(projectID string) (int64, error) {
	var count int64
	err := r.db.Model(&Monitor{}).Where("project_id = ?", projectID).Count(&count).Error
	return count, err
}

func (r *repository) Create(m *Monitor) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return r.db.Create(m).Error
}

func (r *repository) Update(m *Monitor) error {
	m.UpdatedAt = time.Now()
	return r.db.Save(m).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&Monitor{}).Error
}

func (r *repository) UpdateStatus(id string, status MonitorStatus, checkedAt time.Time) error {
	return r.db.Model(&Monitor{}).Where("id = ?", id).Updates(map[string]any{
		"last_status":     status,
		"last_checked_at": checkedAt,
		"updated_at":      time.Now(),
	}).Error
}

func (r *repository) SaveResult(res *Result) error {
	if res.ID == "" {
		res.ID = uuid.New().String()
	}
	return r.db.Create(res).Error
}

func (r *repository) ListResults(monitorID string, limit int) ([]Result, error) {
	var results []Result
	err := r.db.Where("monitor_id = ?", monitorID).
		Order("checked_at DESC").
		Limit(limit).
		Find(&results).Error
	return results, err
}

func (r *repository) PruneResults(monitorID string, keep int) error {
	// Delete all but the most recent `keep` results for the monitor.
	return r.db.Exec(`
		DELETE FROM healthcheck_results
		WHERE monitor_id = ? AND id NOT IN (
			SELECT id FROM healthcheck_results
			WHERE monitor_id = ?
			ORDER BY checked_at DESC
			LIMIT ?
		)`, monitorID, monitorID, keep).Error
}
