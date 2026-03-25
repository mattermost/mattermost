package model

func NewAppError(where string, id string) error {
	return nil
}

func validate() error {
	return NewAppError("Model.Validate", "model.validate.app_error")
}
