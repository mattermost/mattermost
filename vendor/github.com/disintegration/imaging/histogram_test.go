package imaging

import (
	"image"
	"image/color"
	"testing"
)

func TestHistogram(t *testing.T) {
	b := image.Rectangle{image.Point{0, 0}, image.Point{2, 2}}

	i1 := image.NewRGBA(b)
	i1.Set(0, 0, image.Black)
	i1.Set(1, 0, image.White)
	i1.Set(1, 1, image.White)
	i1.Set(0, 1, color.Gray{123})

	h := Histogram(i1)
	if h[0] != 0.25 || h[123] != 0.25 || h[255] != 0.5 {
		t.Errorf("Incorrect histogram for image i1")
	}

	i2 := image.NewRGBA(b)
	i2.Set(0, 0, color.Gray{51})
	i2.Set(0, 1, color.Gray{14})
	i2.Set(1, 0, color.Gray{14})

	h = Histogram(i2)
	if h[14] != 0.5 || h[51] != 0.25 || h[0] != 0.25 {
		t.Errorf("Incorrect histogram for image i2")
	}

	b = image.Rectangle{image.Point{0, 0}, image.Point{0, 0}}
	i3 := image.NewRGBA(b)
	h = Histogram(i3)
	for _, val := range h {
		if val != 0 {
			t.Errorf("Histogram for an empty image should be a zero histogram.")
			return
		}
	}
}
