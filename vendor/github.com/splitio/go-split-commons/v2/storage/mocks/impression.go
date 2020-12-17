package mocks

import "github.com/splitio/go-split-commons/v2/dtos"

// MockImpressionStorage is a mocked implementation of Impression Storage
type MockImpressionStorage struct {
	EmptyCall            func() bool
	CountCall            func() int64
	LogImpressionsCall   func(impressions []dtos.Impression) error
	PopNCall             func(n int64) ([]dtos.Impression, error)
	PopNWithMetadataCall func(n int64) ([]dtos.ImpressionQueueObject, error)
	DropCall             func(size *int64) error
}

// Empty mock
func (m MockImpressionStorage) Empty() bool {
	return m.EmptyCall()
}

// Count mock
func (m MockImpressionStorage) Count() int64 {
	return m.CountCall()
}

// LogImpressions mock
func (m MockImpressionStorage) LogImpressions(impressions []dtos.Impression) error {
	return m.LogImpressionsCall(impressions)
}

// PopN mock
func (m MockImpressionStorage) PopN(n int64) ([]dtos.Impression, error) {
	return m.PopNCall(n)
}

// PopNWithMetadata mock
func (m MockImpressionStorage) PopNWithMetadata(n int64) ([]dtos.ImpressionQueueObject, error) {
	return m.PopNWithMetadataCall(n)
}

// Drop mock
func (m MockImpressionStorage) Drop(size *int64) error {
	return m.Drop(size)
}
