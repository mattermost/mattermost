// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 17/05/2011 by Laurent Le Goff
package curve

import (
	"math"
)

const (
	CurveRecursionLimit = 32
)

//	X1, Y1, X2, Y2, X3, Y3, X4, Y4 float64
type CubicCurveFloat64 [8]float64

type LineTracer interface {
	LineTo(x, y float64)
}

func (c *CubicCurveFloat64) Subdivide(c1, c2 *CubicCurveFloat64) (x23, y23 float64) {
	// Calculate all the mid-points of the line segments
	//----------------------
	c1[0], c1[1] = c[0], c[1]
	c2[6], c2[7] = c[6], c[7]
	c1[2] = (c[0] + c[2]) / 2
	c1[3] = (c[1] + c[3]) / 2
	x23 = (c[2] + c[4]) / 2
	y23 = (c[3] + c[5]) / 2
	c2[4] = (c[4] + c[6]) / 2
	c2[5] = (c[5] + c[7]) / 2
	c1[4] = (c1[2] + x23) / 2
	c1[5] = (c1[3] + y23) / 2
	c2[2] = (x23 + c2[4]) / 2
	c2[3] = (y23 + c2[5]) / 2
	c1[6] = (c1[4] + c2[2]) / 2
	c1[7] = (c1[5] + c2[3]) / 2
	c2[0], c2[1] = c1[6], c1[7]
	return
}

func (curve *CubicCurveFloat64) Segment(t LineTracer, flattening_threshold float64) {
	var curves [CurveRecursionLimit]CubicCurveFloat64
	curves[0] = *curve
	i := 0
	// current curve
	var c *CubicCurveFloat64

	var dx, dy, d2, d3 float64

	for i >= 0 {
		c = &curves[i]
		dx = c[6] - c[0]
		dy = c[7] - c[1]

		d2 = math.Abs(((c[2]-c[6])*dy - (c[3]-c[7])*dx))
		d3 = math.Abs(((c[4]-c[6])*dy - (c[5]-c[7])*dx))

		if (d2+d3)*(d2+d3) < flattening_threshold*(dx*dx+dy*dy) || i == len(curves)-1 {
			t.LineTo(c[6], c[7])
			i--
		} else {
			// second half of bezier go lower onto the stack
			c.Subdivide(&curves[i+1], &curves[i])
			i++
		}
	}
}
