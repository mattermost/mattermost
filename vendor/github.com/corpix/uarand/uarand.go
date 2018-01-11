package uarand

import (
	"math/rand"
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
}

// GetRandom returns a random user agent from UserAgents slice.
func (u *UARand) GetRandom() string {
	return UserAgents[u.Intn(len(UserAgents))]
}

// GetRandom returns a random user agent from UserAgents slice.
// This version is driven by Default configuration.
func GetRandom() string {
	return Default.GetRandom()
}

func New(r Randomizer) *UARand {
	return &UARand{r}
}
