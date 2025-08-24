package audit

type BusinessError struct {
	Msg string
}

func (e BusinessError) Error() string {
	return e.Msg
}

var ErrInvalidIdentifier = BusinessError{Msg: "identifier is required"}

var ErrInvalidUUID = BusinessError{Msg: "invalid UUID format"}
