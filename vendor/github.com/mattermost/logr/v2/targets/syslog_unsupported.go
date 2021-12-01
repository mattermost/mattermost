// +build windows nacl plan9

package targets

import (
	"errors"

	"github.com/mattermost/logr/v2"
	syslog "github.com/wiggin77/srslog"
)

const (
	unsupported = "Syslog target is not supported on this platform."
)

// Syslog outputs log records to local or remote syslog.
type Syslog struct {
	params *SyslogOptions
	writer *syslog.Writer
}

// SyslogOptions provides parameters for dialing a syslog daemon.
type SyslogOptions struct {
	IP       string `json:"ip,omitempty"` // deprecated
	Host     string `json:"host"`
	Port     int    `json:"port"`
	TLS      bool   `json:"tls"`
	Cert     string `json:"cert"`
	Insecure bool   `json:"insecure"`
	Tag      string `json:"tag"`
}

func (so SyslogOptions) CheckValid() error {
	return errors.New(unsupported)
}

// NewSyslogTarget creates a target capable of outputting log records to remote or local syslog, with or without TLS.
func NewSyslogTarget(params *SyslogOptions) (*Syslog, error) {
	return nil, errors.New(unsupported)
}

// Init is called once to initialize the target.
func (s *Syslog) Init() error {
	return errors.New(unsupported)
}

// Write outputs bytes to this file target.
func (s *Syslog) Write(p []byte, rec *logr.LogRec) (int, error) {
	return 0, errors.New(unsupported)
}

// Shutdown is called once to free/close any resources.
// Target queue is already drained when this is called.
func (s *Syslog) Shutdown() error {
	return errors.New(unsupported)
}
