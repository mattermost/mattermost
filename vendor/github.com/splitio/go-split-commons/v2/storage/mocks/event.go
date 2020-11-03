package mocks

import "github.com/splitio/go-split-commons/v2/dtos"

// MockEventStorage is a mocked implementation of Event Storage
type MockEventStorage struct {
	EmptyCall            func() bool
	CountCall            func() int64
	PopNCall             func(n int64) ([]dtos.EventDTO, error)
	PopNWithMetadataCall func(n int64) ([]dtos.QueueStoredEventDTO, error)
	PushCall             func(event dtos.EventDTO, size int) error
	DropCall             func(size *int64) error
}

// Empty mock
func (m MockEventStorage) Empty() bool {
	return m.EmptyCall()
}

// Count mock
func (m MockEventStorage) Count() int64 {
	return m.CountCall()
}

// PopN mock
func (m MockEventStorage) PopN(n int64) ([]dtos.EventDTO, error) {
	return m.PopNCall(n)
}

// PopNWithMetadata mock
func (m MockEventStorage) PopNWithMetadata(n int64) ([]dtos.QueueStoredEventDTO, error) {
	return m.PopNWithMetadataCall(n)
}

// Push mock
func (m MockEventStorage) Push(event dtos.EventDTO, size int) error {
	return m.PushCall(event, size)
}

// Drop mock
func (m MockEventStorage) Drop(size *int64) error {
	return m.Drop(size)
}
