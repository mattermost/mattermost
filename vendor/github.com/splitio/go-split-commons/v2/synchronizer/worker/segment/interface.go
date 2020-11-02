package segment

// SegmentFetcher interface
type SegmentFetcher interface {
	SynchronizeSegment(name string, till *int64) error
	SynchronizeSegments() error
	SegmentNames() []interface{}
}
