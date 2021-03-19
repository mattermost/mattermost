package push

// Borrowed synchronizer interface to break circular dependencies
type synchronizerInterface interface {
	SyncAll(requestNoCache bool) error
	SynchronizeSplits(till *int64, requestNoCache bool) error
	LocalKill(splitName string, defaultTreatment string, changeNumber int64)
	SynchronizeSegment(segmentName string, till *int64, requestNoCache bool) error
	StartPeriodicFetching()
	StopPeriodicFetching()
	StartPeriodicDataRecording()
	StopPeriodicDataRecording()
}
