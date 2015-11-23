package main

import (
	"time"
)

import l4g "github.com/mattermost/platform/Godeps/_workspace/src/code.google.com/p/log4go"

func main() {
	log := l4g.NewLogger()
	log.AddFilter("stdout", l4g.DEBUG, l4g.NewConsoleLogWriter())
	log.Info("The time is now: %s", time.Now().Format("15:04:05 MST 2006/01/02"))
}
