package synchronizer

// Synchronizer interface for syncing data to and from splits servers
type Synchronizer interface {
	SyncAll(requestNoCache bool) error
	SynchronizeSplits(till *int64, requestNoCache bool) error
	LocalKill(splitName string, defaultTreatment string, changeNumber int64)
	SynchronizeSegment(segmentName string, till *int64, requestNoCache bool) error
	StartPeriodicFetching()
	StopPeriodicFetching()
	StartPeriodicDataRecording()
	StopPeriodicDataRecording()
}
