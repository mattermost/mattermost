package mocks

import "github.com/splitio/go-toolkit/v3/datastructures/set"

// MockSegmentStorage is a mocked implementation of Segment Storage
type MockSegmentStorage struct {
	ChangeNumberCall       func(segmentName string) (int64, error)
	KeysCall               func(segmentName string) *set.ThreadUnsafeSet
	UpdateCall             func(name string, toAdd *set.ThreadUnsafeSet, toRemove *set.ThreadUnsafeSet, changeNumber int64) error
	SegmentContainsKeyCall func(segmentName string, key string) (bool, error)
	SetChangeNumberCall    func(segmentName string, till int64) error
	CountRemovedKeysCall   func(segmentName string) int64
}

// ChangeNumber mock
func (m MockSegmentStorage) ChangeNumber(segmentName string) (int64, error) {
	return m.ChangeNumberCall(segmentName)
}

// Keys mock
func (m MockSegmentStorage) Keys(segmentName string) *set.ThreadUnsafeSet {
	return m.KeysCall(segmentName)
}

// Update mock
func (m MockSegmentStorage) Update(name string, toAdd *set.ThreadUnsafeSet, toRemove *set.ThreadUnsafeSet, changeNumber int64) error {
	return m.UpdateCall(name, toAdd, toRemove, changeNumber)
}

// SegmentContainsKey mock
func (m MockSegmentStorage) SegmentContainsKey(segmentName string, key string) (bool, error) {
	return m.SegmentContainsKeyCall(segmentName, key)
}

// SetChangeNumber mock
func (m MockSegmentStorage) SetChangeNumber(segmentName string, till int64) error {
	return m.SetChangeNumberCall(segmentName, till)
}

// CountRemovedKeys mock
func (m MockSegmentStorage) CountRemovedKeys(segmentName string) int64 {
	return m.CountRemovedKeysCall(segmentName)
}
