package tasks

import (
	"errors"
)

// SegmentWorker struct contains resources and functions for fetching segments and storing them
type SegmentWorker struct {
	name        string
	failureTime int64
	toExecute   func(name string, till *int64) error
}

// NewSegmentWorker some
func NewSegmentWorker(name string, failureTime int64, toExecute func(name string, till *int64) error) *SegmentWorker {
	return &SegmentWorker{
		name:        name,
		failureTime: failureTime,
		toExecute:   toExecute,
	}
}

// Name Returns the name of the worker
func (w *SegmentWorker) Name() string {
	return w.name
}

// FailureTime Returns how much time should be waited after an error, before the worker resumes execution
func (w *SegmentWorker) FailureTime() int64 {
	return w.failureTime
}

// DoWork performs the actual work and returns an error if something goes wrong
func (w *SegmentWorker) DoWork(msg interface{}) error {
	segmentName, ok := msg.(string)
	if !ok {
		return errors.New("segment name popped from queue is not a string")
	}

	return w.toExecute(segmentName, nil)
}

// OnError callback does nothing
func (w *SegmentWorker) OnError(e error) {}

// Cleanup callback does nothing
func (w *SegmentWorker) Cleanup() error { return nil }
