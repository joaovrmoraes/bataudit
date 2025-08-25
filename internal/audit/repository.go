package audit

import (
	"gorm.io/gorm"
)

type ListResult struct {
	Data       []AuditSummary
	TotalItems int64
}

type Repository interface {
	Create(audit *Audit) error
	List(limit, offset int) (ListResult, error)
	GetByID(id string) (*Audit, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(audit *Audit) error {
	return r.db.Create(audit).Error
}

func (r *repository) List(limit, offset int) (ListResult, error) {
	var audits []AuditSummary
	var totalItems int64

	// total count
	if err := r.db.Model(&Audit{}).Count(&totalItems).Error; err != nil {
		return ListResult{}, err
	}

	// page search
	err := r.db.Model(&Audit{}).
		Select("id, identifier, user_email, user_name, method, path, status_code, service_name, timestamp, response_time").
		Order("timestamp desc").
		Limit(limit).
		Offset(offset).
		Find(&audits).Error
	if err != nil {
		return ListResult{}, err
	}

	return ListResult{
		Data:       audits,
		TotalItems: totalItems,
	}, nil
}

func (r *repository) GetByID(id string) (*Audit, error) {
	var audit Audit
	if err := r.db.First(&audit, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &audit, nil
}
