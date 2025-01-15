package model

type AppError struct{}

func (a *AppError) Error() string {
	return "an error"
}
