package mutexmap

import (
	"sync"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/datastructures/set"
)

// MMSplitStorage struct contains is an in-memory implementation of split storage
type MMSplitStorage struct {
	data         map[string]dtos.SplitDTO
	trafficTypes map[string]int64
	till         int64
	mutex        *sync.RWMutex
	ttMutex      *sync.RWMutex
	tillMutex    *sync.RWMutex
}

// NewMMSplitStorage instantiates a new MMSplitStorage
func NewMMSplitStorage() *MMSplitStorage {
	return &MMSplitStorage{
		data:         make(map[string]dtos.SplitDTO),
		trafficTypes: make(map[string]int64),
		till:         0,
		mutex:        &sync.RWMutex{},
		ttMutex:      &sync.RWMutex{},
		tillMutex:    &sync.RWMutex{},
	}
}

// All returns a list with a copy of each split.
// NOTE: This method will block any further operations regarding splits. Use with caution
func (m *MMSplitStorage) All() []dtos.SplitDTO {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	splitList := make([]dtos.SplitDTO, 0)
	for _, split := range m.data {
		splitList = append(splitList, split)
	}
	return splitList
}

// ChangeNumber returns the last timestamp the split was fetched
func (m *MMSplitStorage) ChangeNumber() (int64, error) {
	m.tillMutex.RLock()
	defer m.tillMutex.RUnlock()
	return m.till, nil
}

func (m *MMSplitStorage) _get(splitName string) *dtos.SplitDTO {
	item, exists := m.data[splitName]
	if !exists {
		return nil
	}
	return &item
}

// FetchMany fetches features in redis and returns an array of split dtos
func (m *MMSplitStorage) FetchMany(splitNames []string) map[string]*dtos.SplitDTO {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	splits := make(map[string]*dtos.SplitDTO)
	for _, splitName := range splitNames {
		splits[splitName] = m._get(splitName)
	}
	return splits
}

// KillLocally kills the split locally
func (m *MMSplitStorage) KillLocally(splitName string, defaultTreatment string, changeNumber int64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	split := m._get(splitName)
	till, err := m.ChangeNumber()
	if err != nil {
		return
	}
	if split != nil && till < changeNumber {
		split.DefaultTreatment = defaultTreatment
		split.Killed = true
		split.ChangeNumber = changeNumber
		m.data[split.Name] = *split
	}
}

// increaseTrafficTypeCount increases value for a traffic type
func (m *MMSplitStorage) increaseTrafficTypeCount(trafficType string) {
	m.ttMutex.Lock()
	defer m.ttMutex.Unlock()
	_, exists := m.trafficTypes[trafficType]
	if !exists {
		m.trafficTypes[trafficType] = 1
	} else {
		m.trafficTypes[trafficType]++
	}
}

// decreaseTrafficTypeCount decreases value for a traffic type
func (m *MMSplitStorage) decreaseTrafficTypeCount(trafficType string) {
	m.ttMutex.Lock()
	defer m.ttMutex.Unlock()
	value, exists := m.trafficTypes[trafficType]
	if exists {
		if value > 0 {
			m.trafficTypes[trafficType]--
		} else {
			delete(m.trafficTypes, trafficType)
		}
	}
}

// PutMany bulk inserts splits into the in-memory storage
func (m *MMSplitStorage) PutMany(splits []dtos.SplitDTO, till int64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	for _, split := range splits {
		existing, thisIsAnUpdate := m.data[split.Name]
		if thisIsAnUpdate {
			// If it's an update, we decrement the traffic type count of the existing split,
			// and then add the updated one (as part of the normal flow), in case it's different.
			m.decreaseTrafficTypeCount(existing.TrafficTypeName)
		}
		m.data[split.Name] = split
		m.increaseTrafficTypeCount(split.TrafficTypeName)
	}
	m.SetChangeNumber(till)
}

// Remove deletes a split from the in-memory storage
func (m *MMSplitStorage) Remove(splitName string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	split, exists := m.data[splitName]
	if exists {
		delete(m.data, splitName)
		m.decreaseTrafficTypeCount(split.TrafficTypeName)
	}
}

// SegmentNames returns a slice with the names of all segments referenced in splits
func (m *MMSplitStorage) SegmentNames() *set.ThreadUnsafeSet {
	segments := set.NewSet()
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	for _, split := range m.data {
		for _, condition := range split.Conditions {
			for _, matcher := range condition.MatcherGroup.Matchers {
				if matcher.UserDefinedSegment != nil {
					segments.Add(matcher.UserDefinedSegment.SegmentName)
				}

			}
		}
	}
	return segments
}

// SetChangeNumber sets the till value belong to split
func (m *MMSplitStorage) SetChangeNumber(till int64) error {
	m.tillMutex.Lock()
	defer m.tillMutex.Unlock()
	m.till = till
	return nil
}

// Split retrieves a split from the MMSplitStorage
// NOTE: A pointer TO A COPY is returned, in order to avoid race conditions between
// evaluations and sdk <-> backend sync
func (m *MMSplitStorage) Split(splitName string) *dtos.SplitDTO {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m._get(splitName)
}

// SplitNames returns a slice with the names of all the current splits
func (m *MMSplitStorage) SplitNames() []string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	splitNames := make([]string, 0)
	for key := range m.data {
		splitNames = append(splitNames, key)
	}
	return splitNames
}

// TrafficTypeExists returns true or false depending on existence and counter
// of trafficType
func (m *MMSplitStorage) TrafficTypeExists(trafficType string) bool {
	m.ttMutex.RLock()
	defer m.ttMutex.RUnlock()
	value, exists := m.trafficTypes[trafficType]
	return exists && value > 0
}
