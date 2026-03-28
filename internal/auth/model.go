package auth

import "time"

type UserRole string

const (
	RoleOwner  UserRole = "owner"
	RoleAdmin  UserRole = "admin"
	RoleViewer UserRole = "viewer"
)

type User struct {
	ID           string    `json:"id"         gorm:"primaryKey"`
	Name         string    `json:"name"`
	Email        string    `json:"email"      gorm:"uniqueIndex"`
	PasswordHash string    `json:"-"          gorm:"column:password_hash"`
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type Project struct {
	ID        string    `json:"id"         gorm:"primaryKey"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"       gorm:"uniqueIndex"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type ProjectMember struct {
	UserID    string   `json:"user_id"    gorm:"primaryKey"`
	ProjectID string   `json:"project_id" gorm:"primaryKey"`
	Role      UserRole `json:"role"`
}

type ProjectMemberDetail struct {
	UserID    string   `json:"user_id"`
	ProjectID string   `json:"project_id"`
	Role      UserRole `json:"role"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
}

type APIKey struct {
	ID        string     `json:"id"         gorm:"primaryKey"`
	KeyHash   string     `json:"-"          gorm:"column:key_hash"`
	ProjectID string     `json:"project_id"`
	Name      string     `json:"name"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
	Active    bool       `json:"active"     gorm:"default:true"`
}
