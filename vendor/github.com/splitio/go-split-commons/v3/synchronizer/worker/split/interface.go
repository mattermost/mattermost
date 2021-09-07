package split

// Updater interface
type Updater interface {
	SynchronizeSplits(till *int64, requestNoCache bool) ([]string, error)
	LocalKill(splitName string, defaultTreatment string, changeNumber int64)
}
