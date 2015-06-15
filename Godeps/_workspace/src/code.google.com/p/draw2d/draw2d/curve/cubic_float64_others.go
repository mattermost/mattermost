// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 17/05/2011 by Laurent Le Goff
package curve

import (
	"math"
)

const (
	CurveCollinearityEpsilon   = 1e-30
	CurveAngleToleranceEpsilon = 0.01
)

//mu ranges from 0 to 1, start to end of curve
func (c *CubicCurveFloat64) ArbitraryPoint(mu float64) (x, y float64) {

	mum1 := 1 - mu
	mum13 := mum1 * mum1 * mum1
	mu3 := mu * mu * mu

	x = mum13*c[0] + 3*mu*mum1*mum1*c[2] + 3*mu*mu*mum1*c[4] + mu3*c[6]
	y = mum13*c[1] + 3*mu*mum1*mum1*c[3] + 3*mu*mu*mum1*c[5] + mu3*c[7]
	return
}

func (c *CubicCurveFloat64) SubdivideAt(c1, c2 *CubicCurveFloat64, t float64) (x23, y23 float64) {
	inv_t := (1 - t)
	c1[0], c1[1] = c[0], c[1]
	c2[6], c2[7] = c[6], c[7]

	c1[2] = inv_t*c[0] + t*c[2]
	c1[3] = inv_t*c[1] + t*c[3]

	x23 = inv_t*c[2] + t*c[4]
	y23 = inv_t*c[3] + t*c[5]

	c2[4] = inv_t*c[4] + t*c[6]
	c2[5] = inv_t*c[5] + t*c[7]

	c1[4] = inv_t*c1[2] + t*x23
	c1[5] = inv_t*c1[3] + t*y23

	c2[2] = inv_t*x23 + t*c2[4]
	c2[3] = inv_t*y23 + t*c2[5]

	c1[6] = inv_t*c1[4] + t*c2[2]
	c1[7] = inv_t*c1[5] + t*c2[3]

	c2[0], c2[1] = c1[6], c1[7]
	return
}

func (c *CubicCurveFloat64) EstimateDistance() float64 {
	dx1 := c[2] - c[0]
	dy1 := c[3] - c[1]
	dx2 := c[4] - c[2]
	dy2 := c[5] - c[3]
	dx3 := c[6] - c[4]
	dy3 := c[7] - c[5]
	return math.Sqrt(dx1*dx1+dy1*dy1) + math.Sqrt(dx2*dx2+dy2*dy2) + math.Sqrt(dx3*dx3+dy3*dy3)
}

// subdivide the curve in straight lines using line approximation and Casteljau recursive subdivision 
func (c *CubicCurveFloat64) SegmentRec(t LineTracer, flattening_threshold float64) {
	c.segmentRec(t, flattening_threshold)
	t.LineTo(c[6], c[7])
}

func (c *CubicCurveFloat64) segmentRec(t LineTracer, flattening_threshold float64) {
	var c1, c2 CubicCurveFloat64
	c.Subdivide(&c1, &c2)

	// Try to approximate the full cubic curve by a single straight line
	//------------------
	dx := c[6] - c[0]
	dy := c[7] - c[1]

	d2 := math.Abs(((c[2]-c[6])*dy - (c[3]-c[7])*dx))
	d3 := math.Abs(((c[4]-c[6])*dy - (c[5]-c[7])*dx))

	if (d2+d3)*(d2+d3) < flattening_threshold*(dx*dx+dy*dy) {
		t.LineTo(c[6], c[7])
		return
	}
	// Continue subdivision
	//----------------------
	c1.segmentRec(t, flattening_threshold)
	c2.segmentRec(t, flattening_threshold)
}

/*
	The function has the following parameters:
		approximationScale : 
			Eventually determines the approximation accuracy. In practice we need to transform points from the World coordinate system to the Screen one. 
			It always has some scaling coefficient. 
			The curves are usually processed in the World coordinates, while the approximation accuracy should be eventually in pixels. 
			Usually it looks as follows: 
			curved.approximationScale(transform.scale()); 
			where transform is the affine matrix that includes all the transformations, including viewport and zoom.
		angleTolerance :
			You set it in radians. 
			The less this value is the more accurate will be the approximation at sharp turns. 
			But 0 means that we don't consider angle conditions at all.
		cuspLimit :
			An angle in radians. 
			If 0, only the real cusps will have bevel cuts. 
			If more than 0, it will restrict the sharpness. 
			The more this value is the less sharp turns will be cut. 
			Typically it should not exceed 10-15 degrees.
*/
func (c *CubicCurveFloat64) AdaptiveSegmentRec(t LineTracer, approximationScale, angleTolerance, cuspLimit float64) {
	cuspLimit = computeCuspLimit(cuspLimit)
	distanceToleranceSquare := 0.5 / approximationScale
	distanceToleranceSquare = distanceToleranceSquare * distanceToleranceSquare
	c.adaptiveSegmentRec(t, 0, distanceToleranceSquare, angleTolerance, cuspLimit)
	t.LineTo(c[6], c[7])
}

func computeCuspLimit(v float64) (r float64) {
	if v == 0.0 {
		r = 0.0
	} else {
		r = math.Pi - v
	}
	return
}

func squareDistance(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return dx*dx + dy*dy
}

/**
 * http://www.antigrain.com/research/adaptive_bezier/index.html
 */
func (c *CubicCurveFloat64) adaptiveSegmentRec(t LineTracer, level int, distanceToleranceSquare, angleTolerance, cuspLimit float64) {
	if level > CurveRecursionLimit {
		return
	}
	var c1, c2 CubicCurveFloat64
	x23, y23 := c.Subdivide(&c1, &c2)

	// Try to approximate the full cubic curve by a single straight line
	//------------------
	dx := c[6] - c[0]
	dy := c[7] - c[1]

	d2 := math.Abs(((c[2]-c[6])*dy - (c[3]-c[7])*dx))
	d3 := math.Abs(((c[4]-c[6])*dy - (c[5]-c[7])*dx))
	switch {
	case d2 <= CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
		// All collinear OR p1==p4
		//----------------------
		k := dx*dx + dy*dy
		if k == 0 {
			d2 = squareDistance(c[0], c[1], c[2], c[3])
			d3 = squareDistance(c[6], c[7], c[4], c[5])
		} else {
			k = 1 / k
			da1 := c[2] - c[0]
			da2 := c[3] - c[1]
			d2 = k * (da1*dx + da2*dy)
			da1 = c[4] - c[0]
			da2 = c[5] - c[1]
			d3 = k * (da1*dx + da2*dy)
			if d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1 {
				// Simple collinear case, 1---2---3---4
				// We can leave just two endpoints
				return
			}
			if d2 <= 0 {
				d2 = squareDistance(c[2], c[3], c[0], c[1])
			} else if d2 >= 1 {
				d2 = squareDistance(c[2], c[3], c[6], c[7])
			} else {
				d2 = squareDistance(c[2], c[3], c[0]+d2*dx, c[1]+d2*dy)
			}

			if d3 <= 0 {
				d3 = squareDistance(c[4], c[5], c[0], c[1])
			} else if d3 >= 1 {
				d3 = squareDistance(c[4], c[5], c[6], c[7])
			} else {
				d3 = squareDistance(c[4], c[5], c[0]+d3*dx, c[1]+d3*dy)
			}
		}
		if d2 > d3 {
			if d2 < distanceToleranceSquare {
				t.LineTo(c[2], c[3])
				return
			}
		} else {
			if d3 < distanceToleranceSquare {
				t.LineTo(c[4], c[5])
				return
			}
		}

	case d2 <= CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
		// p1,p2,p4 are collinear, p3 is significant
		//----------------------
		if d3*d3 <= distanceToleranceSquare*(dx*dx+dy*dy) {
			if angleTolerance < CurveAngleToleranceEpsilon {
				t.LineTo(x23, y23)
				return
			}

			// Angle Condition
			//----------------------
			da1 := math.Abs(math.Atan2(c[7]-c[5], c[6]-c[4]) - math.Atan2(c[5]-c[3], c[4]-c[2]))
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}

			if da1 < angleTolerance {
				t.LineTo(c[2], c[3])
				t.LineTo(c[4], c[5])
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					t.LineTo(c[4], c[5])
					return
				}
			}
		}

	case d2 > CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
		// p1,p3,p4 are collinear, p2 is significant
		//----------------------
		if d2*d2 <= distanceToleranceSquare*(dx*dx+dy*dy) {
			if angleTolerance < CurveAngleToleranceEpsilon {
				t.LineTo(x23, y23)
				return
			}

			// Angle Condition
			//----------------------
			da1 := math.Abs(math.Atan2(c[5]-c[3], c[4]-c[2]) - math.Atan2(c[3]-c[1], c[2]-c[0]))
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}

			if da1 < angleTolerance {
				t.LineTo(c[2], c[3])
				t.LineTo(c[4], c[5])
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					t.LineTo(c[2], c[3])
					return
				}
			}
		}

	case d2 > CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
		// Regular case
		//-----------------
		if (d2+d3)*(d2+d3) <= distanceToleranceSquare*(dx*dx+dy*dy) {
			// If the curvature doesn't exceed the distanceTolerance value
			// we tend to finish subdivisions.
			//----------------------
			if angleTolerance < CurveAngleToleranceEpsilon {
				t.LineTo(x23, y23)
				return
			}

			// Angle & Cusp Condition
			//----------------------
			k := math.Atan2(c[5]-c[3], c[4]-c[2])
			da1 := math.Abs(k - math.Atan2(c[3]-c[1], c[2]-c[0]))
			da2 := math.Abs(math.Atan2(c[7]-c[5], c[6]-c[4]) - k)
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}
			if da2 >= math.Pi {
				da2 = 2*math.Pi - da2
			}

			if da1+da2 < angleTolerance {
				// Finally we can stop the recursion
				//----------------------
				t.LineTo(x23, y23)
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					t.LineTo(c[2], c[3])
					return
				}

				if da2 > cuspLimit {
					t.LineTo(c[4], c[5])
					return
				}
			}
		}
	}

	// Continue subdivision
	//----------------------
	c1.adaptiveSegmentRec(t, level+1, distanceToleranceSquare, angleTolerance, cuspLimit)
	c2.adaptiveSegmentRec(t, level+1, distanceToleranceSquare, angleTolerance, cuspLimit)

}

func (curve *CubicCurveFloat64) AdaptiveSegment(t LineTracer, approximationScale, angleTolerance, cuspLimit float64) {
	cuspLimit = computeCuspLimit(cuspLimit)
	distanceToleranceSquare := 0.5 / approximationScale
	distanceToleranceSquare = distanceToleranceSquare * distanceToleranceSquare

	var curves [CurveRecursionLimit]CubicCurveFloat64
	curves[0] = *curve
	i := 0
	// current curve
	var c *CubicCurveFloat64
	var c1, c2 CubicCurveFloat64
	var dx, dy, d2, d3, k, x23, y23 float64
	for i >= 0 {
		c = &curves[i]
		x23, y23 = c.Subdivide(&c1, &c2)

		// Try to approximate the full cubic curve by a single straight line
		//------------------
		dx = c[6] - c[0]
		dy = c[7] - c[1]

		d2 = math.Abs(((c[2]-c[6])*dy - (c[3]-c[7])*dx))
		d3 = math.Abs(((c[4]-c[6])*dy - (c[5]-c[7])*dx))
		switch {
		case i == len(curves)-1:
			t.LineTo(c[6], c[7])
			i--
			continue
		case d2 <= CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
			// All collinear OR p1==p4
			//----------------------
			k = dx*dx + dy*dy
			if k == 0 {
				d2 = squareDistance(c[0], c[1], c[2], c[3])
				d3 = squareDistance(c[6], c[7], c[4], c[5])
			} else {
				k = 1 / k
				da1 := c[2] - c[0]
				da2 := c[3] - c[1]
				d2 = k * (da1*dx + da2*dy)
				da1 = c[4] - c[0]
				da2 = c[5] - c[1]
				d3 = k * (da1*dx + da2*dy)
				if d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1 {
					// Simple collinear case, 1---2---3---4
					// We can leave just two endpoints
					i--
					continue
				}
				if d2 <= 0 {
					d2 = squareDistance(c[2], c[3], c[0], c[1])
				} else if d2 >= 1 {
					d2 = squareDistance(c[2], c[3], c[6], c[7])
				} else {
					d2 = squareDistance(c[2], c[3], c[0]+d2*dx, c[1]+d2*dy)
				}

				if d3 <= 0 {
					d3 = squareDistance(c[4], c[5], c[0], c[1])
				} else if d3 >= 1 {
					d3 = squareDistance(c[4], c[5], c[6], c[7])
				} else {
					d3 = squareDistance(c[4], c[5], c[0]+d3*dx, c[1]+d3*dy)
				}
			}
			if d2 > d3 {
				if d2 < distanceToleranceSquare {
					t.LineTo(c[2], c[3])
					i--
					continue
				}
			} else {
				if d3 < distanceToleranceSquare {
					t.LineTo(c[4], c[5])
					i--
					continue
				}
			}

		case d2 <= CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
			// p1,p2,p4 are collinear, p3 is significant
			//----------------------
			if d3*d3 <= distanceToleranceSquare*(dx*dx+dy*dy) {
				if angleTolerance < CurveAngleToleranceEpsilon {
					t.LineTo(x23, y23)
					i--
					continue
				}

				// Angle Condition
				//----------------------
				da1 := math.Abs(math.Atan2(c[7]-c[5], c[6]-c[4]) - math.Atan2(c[5]-c[3], c[4]-c[2]))
				if da1 >= math.Pi {
					da1 = 2*math.Pi - da1
				}

				if da1 < angleTolerance {
					t.LineTo(c[2], c[3])
					t.LineTo(c[4], c[5])
					i--
					continue
				}

				if cuspLimit != 0.0 {
					if da1 > cuspLimit {
						t.LineTo(c[4], c[5])
						i--
						continue
					}
				}
			}

		case d2 > CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
			// p1,p3,p4 are collinear, p2 is significant
			//----------------------
			if d2*d2 <= distanceToleranceSquare*(dx*dx+dy*dy) {
				if angleTolerance < CurveAngleToleranceEpsilon {
					t.LineTo(x23, y23)
					i--
					continue
				}

				// Angle Condition
				//----------------------
				da1 := math.Abs(math.Atan2(c[5]-c[3], c[4]-c[2]) - math.Atan2(c[3]-c[1], c[2]-c[0]))
				if da1 >= math.Pi {
					da1 = 2*math.Pi - da1
				}

				if da1 < angleTolerance {
					t.LineTo(c[2], c[3])
					t.LineTo(c[4], c[5])
					i--
					continue
				}

				if cuspLimit != 0.0 {
					if da1 > cuspLimit {
						t.LineTo(c[2], c[3])
						i--
						continue
					}
				}
			}

		case d2 > CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
			// Regular case
			//-----------------
			if (d2+d3)*(d2+d3) <= distanceToleranceSquare*(dx*dx+dy*dy) {
				// If the curvature doesn't exceed the distanceTolerance value
				// we tend to finish subdivisions.
				//----------------------
				if angleTolerance < CurveAngleToleranceEpsilon {
					t.LineTo(x23, y23)
					i--
					continue
				}

				// Angle & Cusp Condition
				//----------------------
				k := math.Atan2(c[5]-c[3], c[4]-c[2])
				da1 := math.Abs(k - math.Atan2(c[3]-c[1], c[2]-c[0]))
				da2 := math.Abs(math.Atan2(c[7]-c[5], c[6]-c[4]) - k)
				if da1 >= math.Pi {
					da1 = 2*math.Pi - da1
				}
				if da2 >= math.Pi {
					da2 = 2*math.Pi - da2
				}

				if da1+da2 < angleTolerance {
					// Finally we can stop the recursion
					//----------------------
					t.LineTo(x23, y23)
					i--
					continue
				}

				if cuspLimit != 0.0 {
					if da1 > cuspLimit {
						t.LineTo(c[2], c[3])
						i--
						continue
					}

					if da2 > cuspLimit {
						t.LineTo(c[4], c[5])
						i--
						continue
					}
				}
			}
		}

		// Continue subdivision
		//----------------------
		curves[i+1], curves[i] = c1, c2
		i++
	}
	t.LineTo(curve[6], curve[7])
}

/********************** Ahmad thesis *******************/

/**************************************************************************************
* This code is the implementation of the Parabolic Approximation (PA). Although *
* it uses recursive subdivision as a safe net for the failing cases, this is an *
* iterative routine and reduces considerably the number of vertices (point) *
* generation. *
**************************************************************************************/

func (c *CubicCurveFloat64) ParabolicSegment(t LineTracer, flattening_threshold float64) {
	estimatedIFP := c.numberOfInflectionPoints()
	if estimatedIFP == 0 {
		// If no inflection points then apply PA on the full Bezier segment.
		c.doParabolicApproximation(t, flattening_threshold)
		return
	}
	// If one or more inflection point then we will have to subdivide the curve
	numOfIfP, t1, t2 := c.findInflectionPoints()
	if numOfIfP == 2 {
		// Case when 2 inflection points then divide at the smallest one first
		var sub1, tmp1, sub2, sub3 CubicCurveFloat64
		c.SubdivideAt(&sub1, &tmp1, t1)
		// Now find the second inflection point in the second curve an subdivide
		numOfIfP, t1, t2 = tmp1.findInflectionPoints()
		if numOfIfP == 2 {
			tmp1.SubdivideAt(&sub2, &sub3, t2)
		} else if numOfIfP == 1 {
			tmp1.SubdivideAt(&sub2, &sub3, t1)
		} else {
			return
		}
		// Use PA for first subsegment
		sub1.doParabolicApproximation(t, flattening_threshold)
		// Use RS for the second (middle) subsegment
		sub2.Segment(t, flattening_threshold)
		// Drop the last point in the array will be added by the PA in third subsegment
		//noOfPoints--;
		// Use PA for the third curve
		sub3.doParabolicApproximation(t, flattening_threshold)
	} else if numOfIfP == 1 {
		// Case where there is one inflection point, subdivide once and use PA on
		// both subsegments
		var sub1, sub2 CubicCurveFloat64
		c.SubdivideAt(&sub1, &sub2, t1)
		sub1.doParabolicApproximation(t, flattening_threshold)
		//noOfPoints--;
		sub2.doParabolicApproximation(t, flattening_threshold)
	} else {
		// Case where there is no inflection USA PA directly
		c.doParabolicApproximation(t, flattening_threshold)
	}
}

// Find the third control point deviation form the axis
func (c *CubicCurveFloat64) thirdControlPointDeviation() float64 {
	dx := c[2] - c[0]
	dy := c[3] - c[1]
	l2 := dx*dx + dy*dy
	if l2 == 0 {
		return 0
	}
	l := math.Sqrt(l2)
	r := (c[3] - c[1]) / l
	s := (c[0] - c[2]) / l
	u := (c[2]*c[1] - c[0]*c[3]) / l
	return math.Abs(r*c[4] + s*c[5] + u)
}

// Find the number of inflection point
func (c *CubicCurveFloat64) numberOfInflectionPoints() int {
	dx21 := (c[2] - c[0])
	dy21 := (c[3] - c[1])
	dx32 := (c[4] - c[2])
	dy32 := (c[5] - c[3])
	dx43 := (c[6] - c[4])
	dy43 := (c[7] - c[5])
	if ((dx21*dy32 - dy21*dx32) * (dx32*dy43 - dy32*dx43)) < 0 {
		return 1 // One inflection point
	} else if ((dx21*dy32 - dy21*dx32) * (dx21*dy43 - dy21*dx43)) > 0 {
		return 0 // No inflection point
	} else {
		// Most cases no inflection point
		b1 := (dx21*dx32 + dy21*dy32) > 0
		b2 := (dx32*dx43 + dy32*dy43) > 0
		if b1 || b2 && !(b1 && b2) { // xor!!
			return 0
		}
	}
	return -1 // cases where there in zero or two inflection points
}

// This is the main function where all the work is done
func (curve *CubicCurveFloat64) doParabolicApproximation(tracer LineTracer, flattening_threshold float64) {
	var c *CubicCurveFloat64
	c = curve
	var d, t, dx, dy, d2, d3 float64
	for {
		dx = c[6] - c[0]
		dy = c[7] - c[1]

		d2 = math.Abs(((c[2]-c[6])*dy - (c[3]-c[7])*dx))
		d3 = math.Abs(((c[4]-c[6])*dy - (c[5]-c[7])*dx))

		if (d2+d3)*(d2+d3) < flattening_threshold*(dx*dx+dy*dy) {
			// If the subsegment deviation satisfy the flatness then store the last
			// point and stop
			tracer.LineTo(c[6], c[7])
			break
		}
		// Find the third control point deviation and the t values for subdivision
		d = c.thirdControlPointDeviation()
		t = 2 * math.Sqrt(flattening_threshold/d/3)
		if t > 1 {
			// Case where the t value calculated is invalid so using RS
			c.Segment(tracer, flattening_threshold)
			break
		}
		// Valid t value to subdivide at that calculated value
		var b1, b2 CubicCurveFloat64
		c.SubdivideAt(&b1, &b2, t)
		// First subsegment should have its deviation equal to flatness
		dx = b1[6] - b1[0]
		dy = b1[7] - b1[1]

		d2 = math.Abs(((b1[2]-b1[6])*dy - (b1[3]-b1[7])*dx))
		d3 = math.Abs(((b1[4]-b1[6])*dy - (b1[5]-b1[7])*dx))

		if (d2+d3)*(d2+d3) > flattening_threshold*(dx*dx+dy*dy) {
			// if not then use RS to handle any mathematical errors
			b1.Segment(tracer, flattening_threshold)
		} else {
			tracer.LineTo(b1[6], b1[7])
		}
		// repeat the process for the left over subsegment.
		c = &b2
	}
}

// Find the actual inflection points and return the number of inflection points found
// if 2 inflection points found, the first one returned will be with smaller t value.
func (curve *CubicCurveFloat64) findInflectionPoints() (int, firstIfp, secondIfp float64) {
	// For Cubic Bezier curve with equation P=a*t^3 + b*t^2 + c*t + d
	// slope of the curve dP/dt = 3*a*t^2 + 2*b*t + c
	// a = (float)(-bez.p1 + 3*bez.p2 - 3*bez.p3 + bez.p4);
	// b = (float)(3*bez.p1 - 6*bez.p2 + 3*bez.p3);
	// c = (float)(-3*bez.p1 + 3*bez.p2);
	ax := (-curve[0] + 3*curve[2] - 3*curve[4] + curve[6])
	bx := (3*curve[0] - 6*curve[2] + 3*curve[4])
	cx := (-3*curve[0] + 3*curve[2])
	ay := (-curve[1] + 3*curve[3] - 3*curve[5] + curve[7])
	by := (3*curve[1] - 6*curve[3] + 3*curve[5])
	cy := (-3*curve[1] + 3*curve[3])
	a := (3 * (ay*bx - ax*by))
	b := (3 * (ay*cx - ax*cy))
	c := (by*cx - bx*cy)
	r2 := (b*b - 4*a*c)
	firstIfp = 0.0
	secondIfp = 0.0
	if r2 >= 0.0 && a != 0.0 {
		r := math.Sqrt(r2)
		firstIfp = ((-b + r) / (2 * a))
		secondIfp = ((-b - r) / (2 * a))
		if (firstIfp > 0.0 && firstIfp < 1.0) && (secondIfp > 0.0 && secondIfp < 1.0) {
			if firstIfp > secondIfp {
				tmp := firstIfp
				firstIfp = secondIfp
				secondIfp = tmp
			}
			if secondIfp-firstIfp > 0.00001 {
				return 2, firstIfp, secondIfp
			} else {
				return 1, firstIfp, secondIfp
			}
		} else if firstIfp > 0.0 && firstIfp < 1.0 {
			return 1, firstIfp, secondIfp
		} else if secondIfp > 0.0 && secondIfp < 1.0 {
			firstIfp = secondIfp
			return 1, firstIfp, secondIfp
		}
		return 0, firstIfp, secondIfp
	}
	return 0, firstIfp, secondIfp
}
