package tasks

import (
	"sync"

	"github.com/splitio/go-toolkit/v3/logging"
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
	wg     *sync.WaitGroup
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
		m.wg.Add(1)
		t.Start()
	}
}

// Stop method
func (m MultipleTask) Stop(blocking bool) error {
	for _, t := range m.tasks {
		go func(t Task) {
			t.Stop(blocking)
			m.wg.Done()
		}(t)
	}
	if blocking {
		m.wg.Wait()
	}
	return nil
}
