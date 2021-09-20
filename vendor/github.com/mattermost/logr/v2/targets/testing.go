package targets

import (
	"strings"
	"sync"
	"testing"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/logr/v2/formatters"
)

// Testing is a simple log target that writes to a (*testing.T) log.
type Testing struct {
	mux sync.Mutex
	t   *testing.T
}

func NewTestingTarget(t *testing.T) *Testing {
	return &Testing{
		t: t,
	}
}

// Init is called once to initialize the target.
func (tt *Testing) Init() error {
	return nil
}

// Write outputs bytes to this file target.
func (tt *Testing) Write(p []byte, rec *logr.LogRec) (int, error) {
	tt.mux.Lock()
	defer tt.mux.Unlock()

	if tt.t != nil {
		s := strings.TrimSpace(string(p))
		tt.t.Log(s)
	}
	return len(p), nil
}

// Shutdown is called once to free/close any resources.
// Target queue is already drained when this is called.
func (tt *Testing) Shutdown() error {
	tt.mux.Lock()
	defer tt.mux.Unlock()

	tt.t = nil
	return nil
}

// CreateTestLogger creates a logger for unit tests. Log records are output to `(*testing.T).Log`.
// A new logger is returned along with a method to shutdown the new logger.
func CreateTestLogger(t *testing.T, levels ...logr.Level) (logger logr.Logger, shutdown func() error) {
	lgr, _ := logr.New()
	filter := logr.NewCustomFilter(levels...)
	formatter := &formatters.Plain{EnableCaller: true}
	target := NewTestingTarget(t)

	if err := lgr.AddTarget(target, "test", filter, formatter, 1000); err != nil {
		t.Fail()
	}
	shutdown = func() error {
		err := lgr.Shutdown()
		if err != nil {
			target.mux.Lock()
			target.t.Error("error shutting down test logger", err)
			target.mux.Unlock()
		}
		return err
	}
	return lgr.NewLogger(), shutdown
}
