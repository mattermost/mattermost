package server

func doStuff(T func(string) string) string {
	return T("server.do_stuff.error")
}

func NewAppError(where string, id string) error {
	return nil
}

func createError() error {
	return NewAppError("Server.DoStuff", "server.create.app_error")
}
