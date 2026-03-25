package enterprise

func doEntStuff(T func(string) string) string {
	return T("ent.license.check.error")
}

func NewAppError(where string, id string) error {
	return nil
}

func createEntError() error {
	return NewAppError("Enterprise.Check", "ent.feature.app_error")
}
