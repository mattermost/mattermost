package common

import "time"

// MinDuration returns the min duration among them
func MinDuration(d1, d2 time.Duration, ds ...time.Duration) time.Duration {
	min := d1
	for _, d := range append(ds, d2) {
		if d < min {
			min = d
		}
	}
	return min
}

// MaxDuration returns the max duration among them
func MaxDuration(d1, d2 time.Duration, ds ...time.Duration) time.Duration {
	max := d1
	for _, d := range append(ds, d2) {
		if d > max {
			max = d
		}
	}
	return max
}
