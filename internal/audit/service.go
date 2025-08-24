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

func (service *Service) ListAudits(limit, offset int) (ListResult, error) {
	return service.repo.List(limit, offset)
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
