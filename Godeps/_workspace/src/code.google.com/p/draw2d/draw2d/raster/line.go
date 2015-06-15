// Copyright 2011 The draw2d Authors. All rights reserved.
// created: 27/05/2011 by Laurent Le Goff
package raster

import (
	"image/color"
	"image/draw"
)

func abs(i int) int {
	if i < 0 {
		return -i
	}
	return i
}

func PolylineBresenham(img draw.Image, c color.Color, s ...float64) {
	for i := 2; i < len(s); i += 2 {
		Bresenham(img, c, int(s[i-2]+0.5), int(s[i-1]+0.5), int(s[i]+0.5), int(s[i+1]+0.5))
	}
}

func Bresenham(img draw.Image, color color.Color, x0, y0, x1, y1 int) {
	dx := abs(x1 - x0)
	dy := abs(y1 - y0)
	var sx, sy int
	if x0 < x1 {
		sx = 1
	} else {
		sx = -1
	}
	if y0 < y1 {
		sy = 1
	} else {
		sy = -1
	}
	err := dx - dy

	var e2 int
	for {
		img.Set(x0, y0, color)
		if x0 == x1 && y0 == y1 {
			return
		}
		e2 = 2 * err
		if e2 > -dy {
			err = err - dy
			x0 = x0 + sx
		}
		if e2 < dx {
			err = err + dx
			y0 = y0 + sy
		}
	}
}
