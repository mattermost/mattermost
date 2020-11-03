package push

import (
	"strings"
	"sync"
)

const (
	// PublisherNotPresent there are no publishers sending data
	PublisherNotPresent = iota
	// PublisherAvailable there are publishers running
	PublisherAvailable
)

const (
	prefix = "[?occupancy=metrics.publishers]"
)

// last struct for storing the last notification
type last struct {
	manager   string
	timestamp int64
	mutex     *sync.RWMutex
}

// Keeper struct
type Keeper struct {
	managers     map[string]int
	activeRegion string
	last         last
	publishers   chan<- int
	mutex        *sync.RWMutex
}

// NewKeeper creates new keeper
func NewKeeper(publishers chan int) *Keeper {
	last := last{
		mutex: &sync.RWMutex{},
	}
	return &Keeper{
		managers:     make(map[string]int),
		activeRegion: "us-east-1",
		mutex:        &sync.RWMutex{},
		publishers:   publishers,
		last:         last,
	}
}

func (k *Keeper) cleanManagerPrefix(manager string) string {
	return strings.Replace(manager, prefix, "", -1)
}

// Publishers returns the quantity of publishers for a particular manager
func (k *Keeper) Publishers(manager string) *int {
	k.mutex.RLock()
	defer k.mutex.RUnlock()
	publisher, ok := k.managers[manager]
	if ok {
		return &publisher
	}
	return nil
}

// UpdateManagers updates current manager count
func (k *Keeper) UpdateManagers(manager string, publishers int) {
	parsedManager := k.cleanManagerPrefix(manager)
	k.mutex.Lock()
	defer k.mutex.Unlock()
	k.managers[parsedManager] = publishers

	isAvailable := false
	for _, publishers := range k.managers {
		if publishers > 0 {
			isAvailable = true
			break
		}
	}
	if !isAvailable {
		k.publishers <- PublisherNotPresent
		return
	}
	k.publishers <- PublisherAvailable
}

// LastNotification return the latest notification saved
func (k *Keeper) LastNotification() (string, int64) {
	k.last.mutex.RLock()
	defer k.last.mutex.RUnlock()
	return k.last.manager, k.last.timestamp
}

// UpdateLastNotification updates last message received
func (k *Keeper) UpdateLastNotification(manager string, timestamp int64) {
	k.last.mutex.Lock()
	defer k.last.mutex.Unlock()
	k.last.manager = k.cleanManagerPrefix(manager)
	k.last.timestamp = timestamp
}
