package impression

// ImpressionRecorder interface
type ImpressionRecorder interface {
	SynchronizeImpressions(bulkSize int64) error
	FlushImpressions(bulkSize int64) error
}
