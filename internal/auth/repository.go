package auth

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ErrNotFound = errors.New("record not found")
var ErrEmailTaken = errors.New("email already in use")
var ErrSlugTaken = errors.New("slug already in use")

type Repository interface {
	// Users
	CreateUser(user *User) error
	GetUserByID(id string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	CountUsers() (int64, error)

	// Projects
	CreateProject(project *Project) error
	GetProjectByID(id string) (*Project, error)
	GetProjectBySlug(slug string) (*Project, error)
	ListProjectsByUser(userID string) ([]Project, error)
	ListAllProjects() ([]Project, error)

	// ProjectMembers
	CreateProjectMember(member *ProjectMember) error
	GetProjectMember(userID, projectID string) (*ProjectMember, error)
	ListMembersByProject(projectID string) ([]ProjectMemberDetail, error)
	UpdateProjectMemberRole(userID, projectID string, role UserRole) error
	DeleteProjectMember(userID, projectID string) error

	// APIKeys
	CreateAPIKey(key *APIKey) error
	GetAPIKeyByHash(keyHash string) (*APIKey, error)
	GetAPIKeyByID(id string) (*APIKey, error)
	ListAPIKeysByProject(projectID string) ([]APIKey, error)
	RevokeAPIKey(id string) error
	UpdateAPIKeyProject(keyID, projectID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// --- Users ---

func (r *repository) CreateUser(user *User) error {
	if err := r.db.Create(user).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key") {
			return ErrEmailTaken
		}
		return err
	}
	return nil
}

func (r *repository) GetUserByID(id string) (*User, error) {
	var user User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *repository) GetUserByEmail(email string) (*User, error) {
	var user User
	if err := r.db.First(&user, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *repository) CountUsers() (int64, error) {
	var count int64
	if err := r.db.Model(&User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// --- Projects ---

func (r *repository) CreateProject(project *Project) error {
	if err := r.db.Create(project).Error; err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key") {
			return ErrSlugTaken
		}
		return err
	}
	return nil
}

func (r *repository) GetProjectByID(id string) (*Project, error) {
	var project Project
	if err := r.db.First(&project, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &project, nil
}

func (r *repository) GetProjectBySlug(slug string) (*Project, error) {
	var project Project
	if err := r.db.First(&project, "slug = ?", slug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &project, nil
}

func (r *repository) ListProjectsByUser(userID string) ([]Project, error) {
	var projects []Project
	err := r.db.
		Joins("JOIN project_members ON project_members.project_id = projects.id").
		Where("project_members.user_id = ?", userID).
		Find(&projects).Error
	return projects, err
}

func (r *repository) ListAllProjects() ([]Project, error) {
	var projects []Project
	return projects, r.db.Find(&projects).Error
}

// --- ProjectMembers ---

func (r *repository) CreateProjectMember(member *ProjectMember) error {
	return r.db.Create(member).Error
}

func (r *repository) GetProjectMember(userID, projectID string) (*ProjectMember, error) {
	var member ProjectMember
	err := r.db.First(&member, "user_id = ? AND project_id = ?", userID, projectID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &member, nil
}

func (r *repository) ListMembersByProject(projectID string) ([]ProjectMemberDetail, error) {
	var results []ProjectMemberDetail
	err := r.db.
		Table("project_members").
		Select("project_members.user_id, project_members.project_id, project_members.role, users.name, users.email").
		Joins("JOIN users ON users.id = project_members.user_id").
		Where("project_members.project_id = ?", projectID).
		Scan(&results).Error
	return results, err
}

func (r *repository) UpdateProjectMemberRole(userID, projectID string, role UserRole) error {
	return r.db.Model(&ProjectMember{}).
		Where("user_id = ? AND project_id = ?", userID, projectID).
		Update("role", role).Error
}

func (r *repository) DeleteProjectMember(userID, projectID string) error {
	return r.db.
		Where("user_id = ? AND project_id = ?", userID, projectID).
		Delete(&ProjectMember{}).Error
}

// --- APIKeys ---

func (r *repository) CreateAPIKey(key *APIKey) error {
	return r.db.Create(key).Error
}

func (r *repository) GetAPIKeyByHash(keyHash string) (*APIKey, error) {
	var key APIKey
	err := r.db.First(&key, "key_hash = ? AND active = true", keyHash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
		return nil, ErrNotFound
	}
	return &key, nil
}

func (r *repository) ListAPIKeysByProject(projectID string) ([]APIKey, error) {
	var keys []APIKey
	return keys, r.db.Where("project_id = ?", projectID).Find(&keys).Error
}

func (r *repository) GetAPIKeyByID(id string) (*APIKey, error) {
	var key APIKey
	if err := r.db.First(&key, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &key, nil
}

func (r *repository) RevokeAPIKey(id string) error {
	return r.db.Model(&APIKey{}).Where("id = ?", id).Update("active", false).Error
}

func (r *repository) UpdateAPIKeyProject(keyID, projectID string) error {
	return r.db.Model(&APIKey{}).Where("id = ?", keyID).Update("project_id", projectID).Error
}
