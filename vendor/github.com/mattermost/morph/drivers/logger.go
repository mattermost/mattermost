package drivers

import "fmt"

type Logger interface {
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

type DefaultLogger struct {
}

func (DefaultLogger) Printf(format string, v ...interface{}) {
	fmt.Printf(format, v...)
}

func (DefaultLogger) Println(v ...interface{}) {
	fmt.Println(v...)
}
