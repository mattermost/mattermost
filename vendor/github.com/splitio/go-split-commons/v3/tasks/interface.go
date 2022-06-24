package tasks

import (
	"sync"

	"github.com/splitio/go-toolkit/v4/logging"
)

// Task interface
type Task interface {
	Start()
	Stop(blocking bool) error
	IsRunning() bool
}

// MultipleTask struct
type MultipleTask struct {
	tasks  []Task
	logger logging.LoggerInterface
}

// IsRunning method
func (m MultipleTask) IsRunning() bool {
	for _, t := range m.tasks {
		if t.IsRunning() {
			return true
		}
	}
	return false
}

// Start method
func (m MultipleTask) Start() {
	for _, t := range m.tasks {
		t.Start()
	}
}

// Stop method
func (m MultipleTask) Stop(blocking bool) error {
	wg := sync.WaitGroup{}
	wg.Add(len(m.tasks))
	for _, t := range m.tasks {
		go func(t Task) {
			t.Stop(blocking)
			wg.Done()
		}(t)
	}
	if blocking {
		wg.Wait()
	}
	return nil
}
