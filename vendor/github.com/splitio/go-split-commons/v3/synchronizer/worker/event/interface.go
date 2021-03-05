package event

// EventRecorder interface
type EventRecorder interface {
	SynchronizeEvents(bulkSize int64) error
	FlushEvents(bulkSize int64) error
}
