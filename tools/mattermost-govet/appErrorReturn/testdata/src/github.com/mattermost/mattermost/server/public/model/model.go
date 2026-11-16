package model

type AppError struct {
	Id string
}

func (e *AppError) Error() string { return e.Id }

func NewAppError(where, id string) *AppError { return &AppError{Id: id} }
