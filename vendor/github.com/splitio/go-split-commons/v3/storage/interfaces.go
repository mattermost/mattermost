package storage

import (
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-toolkit/v4/datastructures/set"
)

// SplitStorageProducer should be implemented by structs that offer writing splits in storage
type SplitStorageProducer interface {
	KillLocally(splitName string, defaultTreatment string, changeNumber int64)
	PutMany(splits []dtos.SplitDTO, changeNumber int64)
	Remove(splitName string)
	SetChangeNumber(changeNumber int64) error
}

// SplitStorageConsumer should be implemented by structs that offer reading splits from storage
type SplitStorageConsumer interface {
	All() []dtos.SplitDTO
	ChangeNumber() (int64, error)
	FetchMany(splitNames []string) map[string]*dtos.SplitDTO
	SegmentNames() *set.ThreadUnsafeSet // Not in Spec
	Split(splitName string) *dtos.SplitDTO
	SplitNames() []string
	TrafficTypeExists(trafficType string) bool
}

// SegmentStorageProducer interface should be implemented by all structs that offer writing segments
type SegmentStorageProducer interface {
	Update(name string, toAdd *set.ThreadUnsafeSet, toRemove *set.ThreadUnsafeSet, changeNumber int64) error
	SetChangeNumber(segmentName string, till int64) error
}

// SegmentStorageConsumer interface should be implemented by all structs that ofer reading segments
type SegmentStorageConsumer interface {
	ChangeNumber(segmentName string) (int64, error)
	CountRemovedKeys(segmentName string) int64
	Keys(segmentName string) *set.ThreadUnsafeSet
	SegmentContainsKey(segmentName string, key string) (bool, error)
	SegmentKeysCount() int64
}

// ImpressionStorageProducer interface should be impemented by structs that accept incoming impressions
type ImpressionStorageProducer interface {
	LogImpressions(impressions []dtos.Impression) error
}

// ImpressionStorageConsumer interface should be implemented by structs that offer popping impressions
type ImpressionStorageConsumer interface {
	Count() int64
	Drop(size *int64) error
	Empty() bool
	PopN(n int64) ([]dtos.Impression, error)
	PopNWithMetadata(n int64) ([]dtos.ImpressionQueueObject, error)
}

// EventStorageProducer interface should be implemented by structs that accept incoming events
type EventStorageProducer interface {
	Push(event dtos.EventDTO, size int) error
}

// EventStorageConsumer interface should be implemented by structs that offer popping impressions
type EventStorageConsumer interface {
	Count() int64
	Drop(size *int64) error
	Empty() bool
	PopN(n int64) ([]dtos.EventDTO, error)
	PopNWithMetadata(n int64) ([]dtos.QueueStoredEventDTO, error)
}

// TelemetryStorageProducer interface should be implemented by struct that accepts incoming telemetry
type TelemetryStorageProducer interface {
	TelemetryConfigProducer
	TelemetryEvaluationProducer
	TelemetryRuntimeProducer
}

// TelemetryRedisProducer interface redis
type TelemetryRedisProducer interface {
	TelemetryConfigProducer
	TelemetryEvaluationProducer
}

// TelemetryConfigProducer interface for config data
type TelemetryConfigProducer interface {
	RecordConfigData(configData dtos.Config) error
	RecordNonReadyUsage()
	RecordBURTimeout()
}

// TelemetryEvaluationProducer for evaluation
type TelemetryEvaluationProducer interface {
	RecordLatency(method string, latency int64)
	RecordException(method string)
}

// TelemetryRuntimeProducer for runtime stats
type TelemetryRuntimeProducer interface {
	AddTag(tag string)
	RecordImpressionsStats(dataType int, count int64)
	RecordEventsStats(dataType int, count int64)
	RecordSuccessfulSync(resource int, time int64)
	RecordSyncError(resource int, status int)
	RecordSyncLatency(resource int, latency int64)
	RecordAuthRejections()
	RecordTokenRefreshes()
	RecordStreamingEvent(streamingEvent *dtos.StreamingEvent)
	RecordSessionLength(session int64)
}

// TelemetryStorageConsumer interface should be implemented by structs that offer popping telemetry
type TelemetryStorageConsumer interface {
	TelemetryConfigConsumer
	TelemetryEvaluationConsumer
	TelemetryRuntimeConsumer
}

// TelemetryConfigConsumer interface for config data
type TelemetryConfigConsumer interface {
	GetNonReadyUsages() int64
	GetBURTimeouts() int64
}

// TelemetryEvaluationConsumer for evaluation
type TelemetryEvaluationConsumer interface {
	PopLatencies() dtos.MethodLatencies
	PopExceptions() dtos.MethodExceptions
}

// TelemetryRuntimeConsumer for runtime stats
type TelemetryRuntimeConsumer interface {
	GetImpressionsStats(dataType int) int64
	GetEventsStats(dataType int) int64
	GetLastSynchronization() dtos.LastSynchronization
	PopHTTPErrors() dtos.HTTPErrors
	PopHTTPLatencies() dtos.HTTPLatencies
	PopAuthRejections() int64
	PopTokenRefreshes() int64
	PopStreamingEvents() []dtos.StreamingEvent
	PopTags() []string
	GetSessionLength() int64
}

// --- Wide Interfaces

// SplitStorage wraps consumer & producer interfaces
type SplitStorage interface {
	SplitStorageProducer
	SplitStorageConsumer
}

// SegmentStorage wraps consumer and producer interfaces
type SegmentStorage interface {
	SegmentStorageProducer
	SegmentStorageConsumer
}

// ImpressionStorage wraps consumer & producer interfaces
type ImpressionStorage interface {
	ImpressionStorageConsumer
	ImpressionStorageProducer
}

// EventsStorage wraps consumer and producer interfaces
type EventsStorage interface {
	EventStorageConsumer
	EventStorageProducer
}

// TelemetryStorage wraps consumer and producer interfaces
type TelemetryStorage interface {
	TelemetryStorageConsumer
	TelemetryStorageProducer
}
