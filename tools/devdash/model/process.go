package model

import "time"

type ProcessState int

const (
	ProcessIdle ProcessState = iota
	ProcessRunning
	ProcessExited
	ProcessFailed
)

type Process struct {
	ID        string
	Repo      string
	Target    string
	Command   string
	State     ProcessState
	StartedAt time.Time
	ExitCode  int
}
