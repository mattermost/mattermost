package impressionscount

// ImpressionsCountRecorder interface
type ImpressionsCountRecorder interface {
	SynchronizeImpressionsCount() error
}
