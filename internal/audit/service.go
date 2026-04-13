package audit

import "github.com/google/uuid"

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (service *Service) CreateAudit(audit Audit) error {
	if audit.Identifier == "" {
		return ErrInvalidIdentifier
	}

	if _, err := uuid.Parse(audit.ID); err != nil {
		return ErrInvalidUUID
	}

	return service.repo.Create(&audit)
}

func (service *Service) ListAudits(limit, offset int, filters ListFilters) (ListResult, error) {
	return service.repo.List(limit, offset, filters)
}

func (service *Service) GetSessions(filters SessionFilters) ([]Session, error) {
	return service.repo.GetSessions(filters)
}

func (service *Service) GetStats(projectID, environment string) (*AuditStats, error) {
	return service.repo.GetStats(projectID, environment)
}

func (service *Service) GetOrphans(filters OrphanFilters) ([]AuditSummary, error) {
	return service.repo.GetOrphans(filters)
}

func (service *Service) GetAuditByID(id string) (*Audit, error) {
	if id == "" {
		return nil, ErrInvalidIdentifier
	}

	if _, err := uuid.Parse(id); err != nil {
		return nil, ErrInvalidUUID
	}

	return service.repo.GetByID(id)
}
