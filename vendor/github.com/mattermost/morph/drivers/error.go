package drivers

import "fmt"

type AppError struct {
	OrigErr error
	Driver  string
	Message string
}

type DatabaseError struct {
	OrigErr error
	Driver  string
	Message string
	Command string
	Query   []byte
}

func (ae *AppError) Error() string {
	return fmt.Sprintf("driver: %s, message: %s, originalError: %v ", ae.Driver, ae.Message, ae.OrigErr)
}

func (de *DatabaseError) Error() string {
	return fmt.Sprintf("driver: %s, message: %s, command: %s, originalError: %v, query: \n\n%s\n", de.Driver, de.Message, de.Command, de.OrigErr, string(de.Query))
}
