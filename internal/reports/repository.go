package reports

import "gorm.io/gorm"

type Repository interface {
	List(projectID string) ([]Report, error)
	Get(id string) (*Report, error)
	Create(r *Report) error
	Update(r *Report) error
	Delete(id string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) List(projectID string) ([]Report, error) {
	var reports []Report
	q := r.db.Order("updated_at DESC")
	if projectID != "" {
		q = q.Where("project_id = ?", projectID)
	}
	return reports, q.Find(&reports).Error
}

func (r *repository) Get(id string) (*Report, error) {
	var report Report
	if err := r.db.First(&report, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *repository) Create(report *Report) error {
	return r.db.Create(report).Error
}

func (r *repository) Update(report *Report) error {
	return r.db.Model(&Report{}).Where("id = ?", report.ID).Updates(map[string]any{
		"name":       report.Name,
		"widgets":    report.Widgets,
		"layout":     report.Layout,
		"updated_at": report.UpdatedAt,
	}).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Delete(&Report{}, "id = ?", id).Error
}
