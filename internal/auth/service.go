package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid credentials")
var ErrOwnerAlreadyExists = errors.New("owner already exists")

type Claims struct {
	UserID string   `json:"user_id"`
	Email  string   `json:"email"`
	Role   UserRole `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	repo      Repository
	jwtSecret []byte
}

func NewService(repo Repository, jwtSecret string) *Service {
	return &Service{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
	}
}

// Login validates credentials and returns a signed JWT.
func (s *Service) Login(email, password string) (string, *User, error) {
	user, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return "", nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, ErrInvalidCredentials
	}

	token, err := s.generateToken(user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// SetupOwner creates the first owner user if no users exist yet.
// Returns nil error if owner already exists (idempotent).
func (s *Service) SetupOwner(name, email, password string) (*User, error) {
	count, err := s.repo.CountUsers()
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrOwnerAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		ID:           uuid.New().String(),
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Role:         RoleOwner,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.CreateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

// ValidateToken parses and validates a JWT string, returning its claims.
func (s *Service) ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// CreateAPIKey generates a new API key, stores its hash, and returns the raw key (shown once).
func (s *Service) CreateAPIKey(projectID, name string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	rawKey := "bat_" + hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	key := &APIKey{
		ID:        uuid.New().String(),
		KeyHash:   keyHash,
		ProjectID: projectID,
		Name:      name,
		CreatedAt: time.Now(),
		Active:    true,
	}

	if err := s.repo.CreateAPIKey(key); err != nil {
		return "", err
	}

	return rawKey, nil
}

// ValidateAPIKey hashes the raw key and looks it up in the DB.
func (s *Service) ValidateAPIKey(rawKey string) (*APIKey, error) {
	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])
	return s.repo.GetAPIKeyByHash(keyHash)
}

// EnsureProject ensures a project with the given serviceName exists.
// If not found, it creates one automatically (slug = serviceName).
// If the API key has no project yet, it gets linked to the resolved project.
// Returns the project_id.
func (s *Service) EnsureProject(serviceName, apiKeyID string) (string, error) {
	project, err := s.repo.GetProjectBySlug(serviceName)
	if err == nil {
		return project.ID, nil
	}
	if err != ErrNotFound {
		return "", err
	}

	// Project doesn't exist — create it automatically.
	newProject := &Project{
		ID:        uuid.New().String(),
		Name:      serviceName,
		Slug:      serviceName,
		CreatedAt: time.Now(),
	}
	if createErr := s.repo.CreateProject(newProject); createErr != nil {
		// Race condition: another request may have created it simultaneously.
		if existing, getErr := s.repo.GetProjectBySlug(serviceName); getErr == nil {
			return existing.ID, nil
		}
		return "", createErr
	}

	// Link the API key to this project if it has none yet.
	if apiKeyID != "" {
		key, keyErr := s.repo.GetAPIKeyByID(apiKeyID)
		if keyErr == nil && key.ProjectID == "" {
			_ = s.repo.UpdateAPIKeyProject(apiKeyID, newProject.ID)
		}
	}

	return newProject.ID, nil
}

func (s *Service) generateToken(user *User) (string, error) {
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
