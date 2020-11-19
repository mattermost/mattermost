package split

// SplitFetcher interface
type SplitFetcher interface {
	SynchronizeSplits(till *int64) error
}
