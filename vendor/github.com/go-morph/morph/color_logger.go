package morph

import (
	"log"

	"github.com/fatih/color"
)

var (
	ErrorLogger      = color.New(color.FgRed, color.Bold)
	ErrorLoggerLight = color.New(color.FgRed)
	InfoLogger       = color.New(color.FgCyan, color.Bold)
	InfoLoggerLight  = color.New(color.FgCyan)
	SuccessLogger    = color.New(color.FgGreen, color.Bold)
)

type Logger interface {
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

type colorLogger struct {
	log *log.Logger
}

func newColorLogger(log *log.Logger) *colorLogger {
	return &colorLogger{log: log}
}

func (l *colorLogger) Printf(format string, v ...interface{}) {
	l.log.Println(InfoLoggerLight.Sprintf(format, v...))
}

func (l *colorLogger) Println(v ...interface{}) {
	l.log.Println(InfoLoggerLight.Sprint(v...))
}
