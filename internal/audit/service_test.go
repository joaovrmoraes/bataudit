package audit

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Mock Repository ---

type mockRepository struct {
	createFn           func(audit *Audit) error
	listFn             func(limit, offset int, filters ListFilters) (ListResult, error)
	exportFn           func(filters ListFilters, maxRows int) ([]AuditSummary, error)
	getByIDFn          func(id string) (*Audit, error)
	getStatsFn         func(projectID string) (*AuditStats, error)
	getSessionsFn      func(filters SessionFilters) ([]Session, error)
	getSessionByIDFn   func(sessionID string) (*SessionDetail, error)
	getOrphansFn       func(filters OrphanFilters) ([]AuditSummary, error)
}

func (m *mockRepository) Create(audit *Audit) error {
	if m.createFn != nil {
		return m.createFn(audit)
	}
	return nil
}

func (m *mockRepository) List(limit, offset int, filters ListFilters) (ListResult, error) {
	if m.listFn != nil {
		return m.listFn(limit, offset, filters)
	}
	return ListResult{}, nil
}

func (m *mockRepository) Export(filters ListFilters, maxRows int) ([]AuditSummary, error) {
	if m.exportFn != nil {
		return m.exportFn(filters, maxRows)
	}
	return nil, nil
}

func (m *mockRepository) GetByID(id string) (*Audit, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, nil
}

func (m *mockRepository) GetStats(projectID string) (*AuditStats, error) {
	if m.getStatsFn != nil {
		return m.getStatsFn(projectID)
	}
	return &AuditStats{}, nil
}

func (m *mockRepository) GetSessions(filters SessionFilters) ([]Session, error) {
	if m.getSessionsFn != nil {
		return m.getSessionsFn(filters)
	}
	return nil, nil
}

func (m *mockRepository) GetSessionByID(sessionID string) (*SessionDetail, error) {
	if m.getSessionByIDFn != nil {
		return m.getSessionByIDFn(sessionID)
	}
	return nil, nil
}

func (m *mockRepository) GetOrphans(filters OrphanFilters) ([]AuditSummary, error) {
	if m.getOrphansFn != nil {
		return m.getOrphansFn(filters)
	}
	return nil, nil
}

// --- Helpers ---

func newService(repo Repository) *Service {
	return NewService(repo)
}

func validAudit() Audit {
	return Audit{
		ID:          "550e8400-e29b-41d4-a716-446655440000",
		Method:      GET,
		Path:        "/api/v1/users",
		StatusCode:  200,
		Identifier:  "user-123",
		ServiceName: "my-service",
		Environment: "production",
		Timestamp:   time.Now(),
	}
}

// --- CreateAudit ---

func TestCreateAudit_Valid(t *testing.T) {
	repo := &mockRepository{}
	svc := newService(repo)

	err := svc.CreateAudit(validAudit())
	assert.NoError(t, err)
}

func TestCreateAudit_EmptyIdentifier(t *testing.T) {
	repo := &mockRepository{}
	svc := newService(repo)

	a := validAudit()
	a.Identifier = ""
	err := svc.CreateAudit(a)
	assert.ErrorIs(t, err, ErrInvalidIdentifier)
}

func TestCreateAudit_InvalidUUID(t *testing.T) {
	repo := &mockRepository{}
	svc := newService(repo)

	a := validAudit()
	a.ID = "not-a-valid-uuid"
	err := svc.CreateAudit(a)
	assert.ErrorIs(t, err, ErrInvalidUUID)
}

func TestCreateAudit_EmptyID_ReturnsInvalidUUID(t *testing.T) {
	// The service validates UUID via uuid.Parse — empty string fails parsing.
	// The handler is responsible for generating the ID before calling the service.
	repo := &mockRepository{}
	svc := newService(repo)

	a := validAudit()
	a.ID = ""
	err := svc.CreateAudit(a)
	assert.ErrorIs(t, err, ErrInvalidUUID)
}

func TestCreateAudit_PropagatesRepoError(t *testing.T) {
	repoErr := errors.New("db connection lost")
	repo := &mockRepository{
		createFn: func(audit *Audit) error { return repoErr },
	}
	svc := newService(repo)

	err := svc.CreateAudit(validAudit())
	assert.ErrorIs(t, err, repoErr)
}

// --- GetAuditByID ---

func TestGetAuditByID_Valid(t *testing.T) {
	expected := &Audit{ID: "550e8400-e29b-41d4-a716-446655440000"}
	repo := &mockRepository{
		getByIDFn: func(id string) (*Audit, error) { return expected, nil },
	}
	svc := newService(repo)

	result, err := svc.GetAuditByID("550e8400-e29b-41d4-a716-446655440000")
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestGetAuditByID_EmptyID(t *testing.T) {
	repo := &mockRepository{}
	svc := newService(repo)

	_, err := svc.GetAuditByID("")
	assert.ErrorIs(t, err, ErrInvalidIdentifier)
}

func TestGetAuditByID_InvalidUUID(t *testing.T) {
	repo := &mockRepository{}
	svc := newService(repo)

	_, err := svc.GetAuditByID("not-a-uuid")
	assert.ErrorIs(t, err, ErrInvalidUUID)
}

// --- ListAudits ---

func TestListAudits_ReturnsRepoResult(t *testing.T) {
	expected := ListResult{
		Data:       []AuditSummary{{ID: "abc"}},
		TotalItems: 1,
	}
	repo := &mockRepository{
		listFn: func(limit, offset int, filters ListFilters) (ListResult, error) {
			return expected, nil
		},
	}
	svc := newService(repo)

	result, err := svc.ListAudits(10, 0, ListFilters{})
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestListAudits_PropagatesError(t *testing.T) {
	repo := &mockRepository{
		listFn: func(limit, offset int, filters ListFilters) (ListResult, error) {
			return ListResult{}, errors.New("db error")
		},
	}
	svc := newService(repo)

	_, err := svc.ListAudits(10, 0, ListFilters{})
	assert.Error(t, err)
}

// --- GetStats ---

func TestGetStats_ReturnsRepoResult(t *testing.T) {
	expected := &AuditStats{Total: 42, ActiveServices: 3}
	repo := &mockRepository{
		getStatsFn: func(projectID string) (*AuditStats, error) {
			return expected, nil
		},
	}
	svc := newService(repo)

	result, err := svc.GetStats("proj-1")
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestGetStats_ForwardsProjectID(t *testing.T) {
	var capturedID string
	repo := &mockRepository{
		getStatsFn: func(projectID string) (*AuditStats, error) {
			capturedID = projectID
			return &AuditStats{}, nil
		},
	}
	svc := newService(repo)

	svc.GetStats("my-project")
	assert.Equal(t, "my-project", capturedID)
}

// --- GetSessions ---

func TestGetSessions_ReturnsRepoResult(t *testing.T) {
	now := time.Now()
	expected := []Session{
		{
			Identifier:      "user-1",
			ServiceName:     "api",
			SessionStart:    now.Format(time.RFC3339),
			SessionEnd:      now.Add(10 * time.Minute).Format(time.RFC3339),
			DurationSeconds: 600,
			EventCount:      12,
		},
	}
	repo := &mockRepository{
		getSessionsFn: func(filters SessionFilters) ([]Session, error) {
			return expected, nil
		},
	}
	svc := newService(repo)

	result, err := svc.GetSessions(SessionFilters{})
	require.NoError(t, err)
	assert.Equal(t, expected, result)
}

func TestGetSessions_ForwardsFilters(t *testing.T) {
	var capturedFilters SessionFilters
	repo := &mockRepository{
		getSessionsFn: func(filters SessionFilters) ([]Session, error) {
			capturedFilters = filters
			return nil, nil
		},
	}
	svc := newService(repo)

	filters := SessionFilters{Identifier: "user-123", ServiceName: "my-api"}
	svc.GetSessions(filters)
	assert.Equal(t, "user-123", capturedFilters.Identifier)
	assert.Equal(t, "my-api", capturedFilters.ServiceName)
}
