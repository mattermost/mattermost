package backo

import (
	"math"
	"math/rand"
	"time"
)

type Backo struct {
	base   time.Duration
	factor uint8
	jitter float64
	cap    time.Duration
}

// Creates a backo instance with the given parameters
func NewBacko(base time.Duration, factor uint8, jitter float64, cap time.Duration) *Backo {
	return &Backo{base, factor, jitter, cap}
}

// Creates a backo instance with the following defaults:
//   base: 100 milliseconds
//   factor: 2
//   jitter: 0
//   cap: 10 seconds
func DefaultBacko() *Backo {
	return NewBacko(time.Millisecond*100, 2, 0, time.Second*10)
}

// Duration returns the backoff interval for the given attempt.
func (backo *Backo) Duration(attempt int) time.Duration {
	duration := float64(backo.base) * math.Pow(float64(backo.factor), float64(attempt))

	if backo.jitter != 0 {
		random := rand.Float64()
		deviation := math.Floor(random * backo.jitter * duration)
		if (int(math.Floor(random*10)) & 1) == 0 {
			duration = duration - deviation
		} else {
			duration = duration + deviation
		}
	}

	duration = math.Min(float64(duration), float64(backo.cap))
	return time.Duration(duration)
}

// Sleep pauses the current goroutine for the backoff interval for the given attempt.
func (backo *Backo) Sleep(attempt int) {
	duration := backo.Duration(attempt)
	time.Sleep(duration)
}

type Ticker struct {
	done chan struct{}
	C    <-chan time.Time
}

func (b *Backo) NewTicker() *Ticker {
	c := make(chan time.Time, 1)
	ticker := &Ticker{
		done: make(chan struct{}, 1),
		C:    c,
	}

	go func() {
		for i := 0; ; i++ {
			select {
			case t := <-time.After(b.Duration(i)):
				c <- t
			case <-ticker.done:
				close(c)
				return
			}
		}
	}()

	return ticker
}

func (t *Ticker) Stop() {
	t.done <- struct{}{}
}
