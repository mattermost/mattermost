package logger

import (
	"errors"
	"sync"
	"testing"
)

type nopLogAPI struct{}

func (nopLogAPI) LogDebug(string, ...any) {}
func (nopLogAPI) LogInfo(string, ...any)  {}
func (nopLogAPI) LogWarn(string, ...any)  {}
func (nopLogAPI) LogError(string, ...any) {}

func TestDerivedLoggersDoNotShareContext(t *testing.T) {
	base := New(nopLogAPI{}).With(LogContext{"userid": "u1"})
	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() { base.WithError(errors.New("x")).With(LogContext{"k": 1}).Warnf("w") })
	}
	wg.Wait()
	if _, ok := base.Context()[ErrorKey]; ok {
		t.Fatal("WithError wrote into the parent logger context")
	}
}
