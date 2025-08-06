package audit

type Audit struct {
	ID         string   `json:"id"`
	Identifier string   `json:"identifier" validate:"required"`
	Action     string   `json:"action" validate:"required"`
	Tags       []string `json:"tags" validate:"required,min=1"`
	Level      string   `json:"level"`
	Timestamp  string   `json:"timestamp"`
}
