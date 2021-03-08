package segment

// Updater interface
type Updater interface {
	SynchronizeSegment(name string, till *int64, requestNoCache bool) error
	SynchronizeSegments(requestNoCache bool) error
	SegmentNames() []interface{}
	IsSegmentCached(segmentName string) bool
}
