package imaging

import (
	"runtime"
	"testing"
)

func testParallelN(enabled bool, n, procs int) bool {
	data := make([]bool, n)
	before := runtime.GOMAXPROCS(0)
	runtime.GOMAXPROCS(procs)
	parallel(n, func(start, end int) {
		for i := start; i < end; i++ {
			data[i] = true
		}
	})
	for i := 0; i < n; i++ {
		if !data[i] {
			return false
		}
	}
	runtime.GOMAXPROCS(before)
	return true
}

func TestParallel(t *testing.T) {
	for _, e := range []bool{true, false} {
		for _, n := range []int{1, 10, 100, 1000} {
			for _, p := range []int{1, 2, 4, 8, 16, 100} {
				if !testParallelN(e, n, p) {
					t.Errorf("test [parallel %v %d %d] failed", e, n, p)
				}
			}
		}
	}
}

func TestClamp(t *testing.T) {
	td := []struct {
		f float64
		u uint8
	}{
		{0, 0},
		{255, 255},
		{128, 128},
		{0.49, 0},
		{0.50, 1},
		{254.9, 255},
		{254.0, 254},
		{256, 255},
		{2500, 255},
		{-10, 0},
		{127.6, 128},
	}

	for _, d := range td {
		if clamp(d.f) != d.u {
			t.Errorf("test [clamp %v %v] failed: %v", d.f, d.u, clamp(d.f))
		}
	}
}
