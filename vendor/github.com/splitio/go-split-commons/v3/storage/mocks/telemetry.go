package mocks

import "github.com/splitio/go-split-commons/v3/dtos"

// MockTelemetryStorage is a mocked implementation of Telemetry Storage
type MockTelemetryStorage struct {
	RecordConfigDataCall       func(configData dtos.Config) error
	RecordLatencyCall          func(method string, latency int64)
	RecordExceptionCall        func(method string)
	RecordImpressionsStatsCall func(dataType int, count int64)
	RecordEventsStatsCall      func(dataType int, count int64)
	RecordSuccessfulSyncCall   func(resource int, time int64)
	RecordSyncErrorCall        func(resource int, status int)
	RecordSyncLatencyCall      func(resource int, latency int64)
	RecordAuthRejectionsCall   func()
	RecordTokenRefreshesCall   func()
	RecordStreamingEventCall   func(streamingEvent *dtos.StreamingEvent)
	AddTagCall                 func(tag string)
	RecordSessionLengthCall    func(session int64)
	RecordNonReadyUsageCall    func()
	RecordBURTimeoutCall       func()
	PopLatenciesCall           func() dtos.MethodLatencies
	PopExceptionsCall          func() dtos.MethodExceptions
	GetImpressionsStatsCall    func(dataType int) int64
	GetEventsStatsCall         func(dataType int) int64
	GetLastSynchronizationCall func() dtos.LastSynchronization
	PopHTTPErrorsCall          func() dtos.HTTPErrors
	PopHTTPLatenciesCall       func() dtos.HTTPLatencies
	PopAuthRejectionsCall      func() int64
	PopTokenRefreshesCall      func() int64
	PopStreamingEventsCall     func() []dtos.StreamingEvent
	PopTagsCall                func() []string
	GetSessionLengthCall       func() int64
	GetNonReadyUsagesCall      func() int64
	GetBURTimeoutsCall         func() int64
}

// RecordConfig mock
func (m MockTelemetryStorage) RecordConfigData(configData dtos.Config) error {
	return m.RecordConfigDataCall(configData)
}

// RecordLatency mock
func (m MockTelemetryStorage) RecordLatency(method string, latency int64) {
	m.RecordLatencyCall(method, latency)
}

// RecordException mock
func (m MockTelemetryStorage) RecordException(method string) { m.RecordExceptionCall(method) }

// RecordImpressionsStats mock
func (m MockTelemetryStorage) RecordImpressionsStats(dataType int, count int64) {
	m.RecordImpressionsStatsCall(dataType, count)
}

// RecordEventsStats mock
func (m MockTelemetryStorage) RecordEventsStats(dataType int, count int64) {
	m.RecordEventsStatsCall(dataType, count)
}

// RecordSuccessfulSync mock
func (m MockTelemetryStorage) RecordSuccessfulSync(resource int, time int64) {
	m.RecordSuccessfulSyncCall(resource, time)
}

// RecordSyncError mock
func (m MockTelemetryStorage) RecordSyncError(resource int, status int) {
	m.RecordSyncErrorCall(resource, status)
}

// RecordSyncLatency mock
func (m MockTelemetryStorage) RecordSyncLatency(resource int, latency int64) {
	m.RecordSyncLatencyCall(resource, latency)
}

// RecordAuthRejections mock
func (m MockTelemetryStorage) RecordAuthRejections() {
	m.RecordAuthRejectionsCall()
}

// RecordTokenRefreshes mock
func (m MockTelemetryStorage) RecordTokenRefreshes() {
	m.RecordTokenRefreshesCall()
}

// RecordStreamingEvent mock
func (m MockTelemetryStorage) RecordStreamingEvent(streamingEvent *dtos.StreamingEvent) {
	m.RecordStreamingEventCall(streamingEvent)
}

// AddTag mock
func (m MockTelemetryStorage) AddTag(tag string) {
	m.AddTagCall(tag)
}

// RecordSessionLength mock
func (m MockTelemetryStorage) RecordSessionLength(session int64) {
	m.RecordSessionLengthCall(session)
}

// RecordNonReadyUsage mock
func (m MockTelemetryStorage) RecordNonReadyUsage() {
	m.RecordNonReadyUsageCall()
}

// RecordBURTimeout mock
func (m MockTelemetryStorage) RecordBURTimeout() {
	m.RecordBURTimeoutCall()
}

// PopLatencies mock
func (m MockTelemetryStorage) PopLatencies() dtos.MethodLatencies {
	return m.PopLatenciesCall()
}

//PopExceptions mock
func (m MockTelemetryStorage) PopExceptions() dtos.MethodExceptions {
	return m.PopExceptionsCall()
}

// GetImpressionsStats mock
func (m MockTelemetryStorage) GetImpressionsStats(dataType int) int64 {
	return m.GetImpressionsStatsCall(dataType)
}

// GetEventsStats mock
func (m MockTelemetryStorage) GetEventsStats(dataType int) int64 {
	return m.GetEventsStatsCall(dataType)
}

// GetLastSynchronization mock
func (m MockTelemetryStorage) GetLastSynchronization() dtos.LastSynchronization {
	return m.GetLastSynchronizationCall()
}

// PopHTTPErrors mock
func (m MockTelemetryStorage) PopHTTPErrors() dtos.HTTPErrors {
	return m.PopHTTPErrorsCall()
}

// PopHTTPLatencies mock
func (m MockTelemetryStorage) PopHTTPLatencies() dtos.HTTPLatencies {
	return m.PopHTTPLatenciesCall()
}

// PopAuthRejections mock
func (m MockTelemetryStorage) PopAuthRejections() int64 {
	return m.PopAuthRejectionsCall()
}

// PopTokenRefreshes mock
func (m MockTelemetryStorage) PopTokenRefreshes() int64 {
	return m.PopTokenRefreshesCall()
}

// PopStreamingEvents mock
func (m MockTelemetryStorage) PopStreamingEvents() []dtos.StreamingEvent {
	return m.PopStreamingEventsCall()
}

// PopTags mock
func (m MockTelemetryStorage) PopTags() []string {
	return m.PopTagsCall()
}

// GetSessionLength mock
func (m MockTelemetryStorage) GetSessionLength() int64 {
	return m.GetSessionLengthCall()
}

// GetNonReadyUsages mock
func (m MockTelemetryStorage) GetNonReadyUsages() int64 {
	return m.GetNonReadyUsagesCall()
}

// GetBURTimeouts mock
func (m MockTelemetryStorage) GetBURTimeouts() int64 {
	return m.GetBURTimeoutsCall()
}
