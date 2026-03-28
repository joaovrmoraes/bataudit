package anomaly

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	ListByProject(projectID string) ([]AnomalyRule, error)
	Create(rule *AnomalyRule) error
	Update(rule *AnomalyRule) error
	Delete(id string) error
	CreateDefaultRules(projectID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListByProject(projectID string) ([]AnomalyRule, error) {
	var rules []AnomalyRule
	err := r.db.Where("project_id = ?", projectID).Order("created_at ASC").Find(&rules).Error
	return rules, err
}

func (r *repository) Create(rule *AnomalyRule) error {
	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	return r.db.Create(rule).Error
}

func (r *repository) Update(rule *AnomalyRule) error {
	return r.db.Save(rule).Error
}

func (r *repository) Delete(id string) error {
	return r.db.Model(&AnomalyRule{}).Where("id = ?", id).Update("active", false).Error
}

func (r *repository) CreateDefaultRules(projectID string) error {
	rules := DefaultRules(projectID)
	for i := range rules {
		rules[i].ID = uuid.New().String()
	}
	return r.db.Create(&rules).Error
}
