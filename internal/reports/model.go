package reports

import (
	"time"

	"gorm.io/datatypes"
)

// Report is a Studio report: a named set of widgets (each with its own SQL query
// and viz type) plus a grid layout. widgets and layout are opaque JSON owned by
// the frontend.
type Report struct {
	ID        string         `json:"id"         gorm:"primaryKey"`
	ProjectID string         `json:"project_id"`
	Name      string         `json:"name"`
	Widgets   datatypes.JSON `json:"widgets"    gorm:"type:jsonb"`
	Layout    datatypes.JSON `json:"layout"     gorm:"type:jsonb"`
	CreatedBy string         `json:"created_by"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

func (Report) TableName() string { return "reports" }
