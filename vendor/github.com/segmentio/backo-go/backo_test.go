package backo

import (
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/bmizerany/assert"
)

// Tests default backo behaviour.
func TestDefaults(t *testing.T) {
	backo := DefaultBacko()

	assert.Equal(t, milliseconds(100), backo.Duration(0))
	assert.Equal(t, milliseconds(200), backo.Duration(1))
	assert.Equal(t, milliseconds(400), backo.Duration(2))
	assert.Equal(t, milliseconds(800), backo.Duration(3))
}

// Tests backo does not exceed cap.
func TestCap(t *testing.T) {
	backo := NewBacko(milliseconds(100), 2, 0, milliseconds(600))

	assert.Equal(t, milliseconds(100), backo.Duration(0))
	assert.Equal(t, milliseconds(200), backo.Duration(1))
	assert.Equal(t, milliseconds(400), backo.Duration(2))
	assert.Equal(t, milliseconds(600), backo.Duration(3))
}

// Tests that jitter adds randomness.
func TestJitter(t *testing.T) {
	defaultBacko := NewBacko(milliseconds(100), 2, 1, milliseconds(10*1000))
	jitterBacko := NewBacko(milliseconds(100), 2, 1, milliseconds(10*1000))

	// TODO: Check jittered durations are within a range.
	assert.NotEqual(t, jitterBacko.Duration(0), defaultBacko.Duration(0))
	assert.NotEqual(t, jitterBacko.Duration(1), defaultBacko.Duration(1))
	assert.NotEqual(t, jitterBacko.Duration(2), defaultBacko.Duration(2))
	assert.NotEqual(t, jitterBacko.Duration(3), defaultBacko.Duration(3))
}

func ExampleBacko_BackoffDefault() {
	b := DefaultBacko()
	ticker := b.NewTicker()

	for i := 0; i < 6; i++ {
		start := time.Now()
		select {
		case t := <-ticker.C:
			fmt.Println(nearest10Millis(t.Sub(start)))
		}
	}

	ticker.Stop()

	// Output:
	// 100
	// 200
	// 400
	// 800
	// 1600
	// 3200
}

func nearest10Millis(d time.Duration) float64 {
	// Typically d is something like 11 or 21, so do some magic to round the
	// durations to the nearest 10. We divide d by 10, floor it, and multiply it
	// by 10 again.
	return math.Floor(float64(d/time.Millisecond/10) * 10)
}

// Returns the given milliseconds as time.Duration
func milliseconds(ms int64) time.Duration {
	return time.Duration(ms * 1000 * 1000)
}
