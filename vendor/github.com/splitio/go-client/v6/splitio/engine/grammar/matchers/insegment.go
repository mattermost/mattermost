package matchers

import (
	"fmt"

	"github.com/splitio/go-split-commons/v2/storage"
)

// InSegmentMatcher matches if the key passed is in the segment which the matcher was constructed with
type InSegmentMatcher struct {
	Matcher
	segmentName string
}

// Match returns true if the key is in the matcher's segment
func (m *InSegmentMatcher) Match(key string, attributes map[string]interface{}, bucketingKey *string) bool {
	segmentStorage, ok := m.Context.Dependency("segmentStorage").(storage.SegmentStorageConsumer)
	if !ok {
		m.logger.Error("InSegmentMatcher: Unable to retrieve segment storage!")
		return false
	}

	isInSegment, err := segmentStorage.SegmentContainsKey(m.segmentName, key)
	if err != nil {
		m.logger.Error(fmt.Printf("InSegmentMatcher: Segment %s not found", m.segmentName))
	}
	return isInSegment
}

// NewInSegmentMatcher instantiates a new InSegmentMatcher
func NewInSegmentMatcher(negate bool, segmentName string, attributeName *string) *InSegmentMatcher {
	return &InSegmentMatcher{
		Matcher: Matcher{
			negate:        negate,
			attributeName: attributeName,
		},
		segmentName: segmentName,
	}
}
