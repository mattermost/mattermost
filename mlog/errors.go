package mlog

type MMError interface {
	error
	Message() string
	Cause() error
	Fields() []Field
}

type MMGenericError struct {
	Message string  // Message that may be displayed to the end user
	Fields  []Field // Fields will never be displayed to the end user
	Cause   error   // The error that caused this one (if any)
}
