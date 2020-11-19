package mocks

import (
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// MockSplitStorage is a mocked implementation of Split Storage
type MockSplitStorage struct {
	AllCall               func() []dtos.SplitDTO
	ChangeNumberCall      func() (int64, error)
	FetchManyCall         func(splitNames []string) map[string]*dtos.SplitDTO
	KillLocallyCall       func(splitName string, defaultTreatment string, changeNumber int64)
	PutManyCall           func(splits []dtos.SplitDTO, changeNumber int64)
	RemoveCall            func(splitName string)
	SegmentNamesCall      func() *set.ThreadUnsafeSet
	SetChangeNumberCall   func(changeNumber int64) error
	SplitCall             func(splitName string) *dtos.SplitDTO
	SplitNamesCall        func() []string
	TrafficTypeExistsCall func(trafficType string) bool
}

// All mock
func (m MockSplitStorage) All() []dtos.SplitDTO {
	return m.AllCall()
}

// ChangeNumber mock
func (m MockSplitStorage) ChangeNumber() (int64, error) {
	return m.ChangeNumberCall()
}

// FetchMany mock
func (m MockSplitStorage) FetchMany(splitNames []string) map[string]*dtos.SplitDTO {
	return m.FetchManyCall(splitNames)
}

// KillLocally mock
func (m MockSplitStorage) KillLocally(splitName string, defaultTreatment string, changeNumber int64) {
	m.KillLocallyCall(splitName, defaultTreatment, changeNumber)
}

// PutMany mock
func (m MockSplitStorage) PutMany(splits []dtos.SplitDTO, changeNumber int64) {
	m.PutManyCall(splits, changeNumber)
}

// Remove mock
func (m MockSplitStorage) Remove(splitname string) {
	m.RemoveCall(splitname)
}

// SegmentNames mock
func (m MockSplitStorage) SegmentNames() *set.ThreadUnsafeSet {
	return m.SegmentNamesCall()
}

// SetChangeNumber mock
func (m MockSplitStorage) SetChangeNumber(changeNumber int64) error {
	return m.SetChangeNumberCall(changeNumber)
}

// Split mock
func (m MockSplitStorage) Split(splitName string) *dtos.SplitDTO {
	return m.SplitCall(splitName)
}

// SplitNames mock
func (m MockSplitStorage) SplitNames() []string {
	return m.SplitNamesCall()
}

// TrafficTypeExists mock
func (m MockSplitStorage) TrafficTypeExists(trafficType string) bool {
	return m.TrafficTypeExistsCall(trafficType)
}
