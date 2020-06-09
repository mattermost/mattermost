package uarand

import (
	"math/rand"
	"sync"
	"time"
)

var (
	// Default is the UARand with default settings.
	Default = New(
		rand.New(
			rand.NewSource(time.Now().UnixNano()),
		),
	)
)

// Randomizer represents some entity which could provide us an entropy.
type Randomizer interface {
	Seed(n int64)
	Intn(n int) int
}

// UARand describes the user agent randomizer settings.
type UARand struct {
	Randomizer
	UserAgents []string

	mutex sync.Mutex
}

// GetRandom returns a random user agent from UserAgents slice.
func (u *UARand) GetRandom() string {
	u.mutex.Lock()
	n := u.Intn(len(u.UserAgents))
	u.mutex.Unlock()

	return u.UserAgents[n]
}

// GetRandom returns a random user agent from UserAgents slice.
// This version is driven by Default configuration.
func GetRandom() string {
	return Default.GetRandom()
}

// New return UserAgent randomizer settings with default user-agents list
func New(r Randomizer) *UARand {
	return &UARand{
		Randomizer: r,
		UserAgents: UserAgents,
		mutex:      sync.Mutex{},
	}
}

// NewWithCustomList return UserAgent randomizer settings with custom user-agents list
func NewWithCustomList(userAgents []string) *UARand {
	return &UARand{
		Randomizer: rand.New(rand.NewSource(time.Now().UnixNano())),
		UserAgents: userAgents,
		mutex:      sync.Mutex{},
	}
}
