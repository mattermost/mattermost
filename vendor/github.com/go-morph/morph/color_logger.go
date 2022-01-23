package morph

import (
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
