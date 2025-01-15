package model

func NewAppError(where string, id string, params map[string]any, details string, status int) *AppError {
	return &AppError{}
}

type AppError struct{}

func (a *AppError) Wrap(err error) *AppError {
	return a
}
