package throttled

import "time"

// The Quota interface defines the method to implement to describe
// a time-window quota, as required by the RateLimit throttler.
type Quota interface {
	// Quota returns a number of requests allowed, and a duration.
	Quota() (int, time.Duration)
}

// The Delayer interface defines the method to implement to describe
// a delay as required by the Interval throttler.
type Delayer interface {
	// Delay returns a duration.
	Delay() time.Duration
}

// PerSec represents a number of requests per second.
type PerSec int

// Delay returns the duration to wait before the next request can go through,
// so that PerSec(n) == n requests per second at regular intervals.
func (ps PerSec) Delay() time.Duration {
	if ps <= 0 {
		return 0
	}
	return time.Duration(1.0 / float64(ps) * float64(time.Second))
}

// Quota returns the number of requests allowed in a 1 second time window,
// so that PerSec(n) == n requests allowed per second.
func (ps PerSec) Quota() (int, time.Duration) {
	return int(ps), time.Second
}

// PerMin represents a number of requests per minute.
type PerMin int

// Delay returns the duration to wait before the next request can go through,
// so that PerMin(n) == n requests per minute at regular intervals.
func (pm PerMin) Delay() time.Duration {
	if pm <= 0 {
		return 0
	}
	return time.Duration(1.0 / float64(pm) * float64(time.Minute))
}

// Quota returns the number of requests allowed in a 1 minute time window,
// so that PerMin(n) == n requests allowed per minute.
func (pm PerMin) Quota() (int, time.Duration) {
	return int(pm), time.Minute
}

// PerHour represents a number of requests per hour.
type PerHour int

// Delay returns the duration to wait before the next request can go through,
// so that PerHour(n) == n requests per hour at regular intervals.
func (ph PerHour) Delay() time.Duration {
	if ph <= 0 {
		return 0
	}
	return time.Duration(1.0 / float64(ph) * float64(time.Hour))
}

// Quota returns the number of requests allowed in a 1 hour time window,
// so that PerHour(n) == n requests allowed per hour.
func (ph PerHour) Quota() (int, time.Duration) {
	return int(ph), time.Hour
}

// PerDay represents a number of requests per day.
type PerDay int

// Delay returns the duration to wait before the next request can go through,
// so that PerDay(n) == n requests per day at regular intervals.
func (pd PerDay) Delay() time.Duration {
	if pd <= 0 {
		return 0
	}
	return time.Duration(1.0 / float64(pd) * float64(24*time.Hour))
}

// Quota returns the number of requests allowed in a 1 day time window,
// so that PerDay(n) == n requests allowed per day.
func (pd PerDay) Quota() (int, time.Duration) {
	return int(pd), 24 * time.Hour
}

// D represents a custom delay.
type D time.Duration

// Delay returns the duration to wait before the next request can go through,
// which is the custom duration represented by the D value.
func (d D) Delay() time.Duration {
	return time.Duration(d)
}

// Q represents a custom quota.
type Q struct {
	Requests int
	Window   time.Duration
}

// Quota returns the number of requests allowed and the custom time window.
func (q Q) Quota() (int, time.Duration) {
	return q.Requests, q.Window
}
