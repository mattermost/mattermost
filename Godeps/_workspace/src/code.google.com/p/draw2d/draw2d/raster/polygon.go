// Copyright 2011 The draw2d Authors. All rights reserved.
// created: 27/05/2011 by Laurent Le Goff
package raster

const (
	POLYGON_CLIP_NONE = iota
	POLYGON_CLIP_LEFT
	POLYGON_CLIP_RIGHT
	POLYGON_CLIP_TOP
	POLYGON_CLIP_BOTTOM
)

type Polygon []float64

type PolygonEdge struct {
	X, Slope            float64
	FirstLine, LastLine int
	Winding             int16
}

//! A more optimized representation of a polygon edge.
type PolygonScanEdge struct {
	FirstLine, LastLine int
	Winding             int16
	X                   Fix
	Slope               Fix
	SlopeFix            Fix
	NextEdge            *PolygonScanEdge
}

//! Calculates the edges of the polygon with transformation and clipping to edges array.
/*! \param startIndex the index for the first vertex.
 *  \param vertexCount the amount of vertices to convert.
 *  \param edges the array for result edges. This should be able to contain 2*aVertexCount edges.
 *  \param tr the transformation matrix for the polygon.
 *  \param aClipRectangle the clip rectangle.
 *  \return the amount of edges in the result.
 */
func (p Polygon) getEdges(startIndex, vertexCount int, edges []PolygonEdge, tr [6]float64, clipBound [4]float64) int {
	startIndex = startIndex * 2
	endIndex := startIndex + vertexCount*2
	if endIndex > len(p) {
		endIndex = len(p)
	}

	x := p[startIndex]
	y := p[startIndex+1]
	// inline transformation
	prevX := x*tr[0] + y*tr[2] + tr[4]
	prevY := x*tr[1] + y*tr[3] + tr[5]

	//! Calculates the clip flags for a point.
	prevClipFlags := POLYGON_CLIP_NONE
	if prevX < clipBound[0] {
		prevClipFlags |= POLYGON_CLIP_LEFT
	} else if prevX >= clipBound[2] {
		prevClipFlags |= POLYGON_CLIP_RIGHT
	}

	if prevY < clipBound[1] {
		prevClipFlags |= POLYGON_CLIP_TOP
	} else if prevY >= clipBound[3] {
		prevClipFlags |= POLYGON_CLIP_BOTTOM
	}

	edgeCount := 0
	var k, clipFlags, clipSum, clipUnion int
	var xleft, yleft, xright, yright, oldY, maxX, minX float64
	var swapWinding int16
	for n := startIndex; n < endIndex; n = n + 2 {
		k = (n + 2) % len(p)
		x = p[k]*tr[0] + p[k+1]*tr[2] + tr[4]
		y = p[k]*tr[1] + p[k+1]*tr[3] + tr[5]

		//! Calculates the clip flags for a point.
		clipFlags = POLYGON_CLIP_NONE
		if prevX < clipBound[0] {
			clipFlags |= POLYGON_CLIP_LEFT
		} else if prevX >= clipBound[2] {
			clipFlags |= POLYGON_CLIP_RIGHT
		}
		if prevY < clipBound[1] {
			clipFlags |= POLYGON_CLIP_TOP
		} else if prevY >= clipBound[3] {
			clipFlags |= POLYGON_CLIP_BOTTOM
		}

		clipSum = prevClipFlags | clipFlags
		clipUnion = prevClipFlags & clipFlags

		// Skip all edges that are either completely outside at the top or at the bottom.
		if clipUnion&(POLYGON_CLIP_TOP|POLYGON_CLIP_BOTTOM) == 0 {
			if clipUnion&POLYGON_CLIP_RIGHT != 0 {
				// Both clip to right, edge is a vertical line on the right side
				if getVerticalEdge(prevY, y, clipBound[2], &edges[edgeCount], clipBound) {
					edgeCount++
				}
			} else if clipUnion&POLYGON_CLIP_LEFT != 0 {
				// Both clip to left, edge is a vertical line on the left side
				if getVerticalEdge(prevY, y, clipBound[0], &edges[edgeCount], clipBound) {
					edgeCount++
				}
			} else if clipSum&(POLYGON_CLIP_RIGHT|POLYGON_CLIP_LEFT) == 0 {
				// No clipping in the horizontal direction
				if getEdge(prevX, prevY, x, y, &edges[edgeCount], clipBound) {
					edgeCount++
				}
			} else {
				// Clips to left or right or both.

				if x < prevX {
					xleft, yleft = x, y
					xright, yright = prevX, prevY
					swapWinding = -1
				} else {
					xleft, yleft = prevX, prevY
					xright, yright = x, y
					swapWinding = 1
				}

				slope := (yright - yleft) / (xright - xleft)

				if clipSum&POLYGON_CLIP_RIGHT != 0 {
					// calculate new position for the right vertex
					oldY = yright
					maxX = clipBound[2]

					yright = yleft + (maxX-xleft)*slope
					xright = maxX

					// add vertical edge for the overflowing part
					if getVerticalEdge(yright, oldY, maxX, &edges[edgeCount], clipBound) {
						edges[edgeCount].Winding *= swapWinding
						edgeCount++
					}
				}

				if clipSum&POLYGON_CLIP_LEFT != 0 {
					// calculate new position for the left vertex
					oldY = yleft
					minX = clipBound[0]

					yleft = yleft + (minX-xleft)*slope
					xleft = minX

					// add vertical edge for the overflowing part
					if getVerticalEdge(oldY, yleft, minX, &edges[edgeCount], clipBound) {
						edges[edgeCount].Winding *= swapWinding
						edgeCount++
					}
				}

				if getEdge(xleft, yleft, xright, yright, &edges[edgeCount], clipBound) {
					edges[edgeCount].Winding *= swapWinding
					edgeCount++
				}
			}
		}

		prevClipFlags = clipFlags
		prevX = x
		prevY = y
	}

	return edgeCount
}

//! Creates a polygon edge between two vectors.
/*! Clips the edge vertically to the clip rectangle. Returns true for edges that
 *  should be rendered, false for others.
 */
func getEdge(x0, y0, x1, y1 float64, edge *PolygonEdge, clipBound [4]float64) bool {
	var startX, startY, endX, endY float64
	var winding int16

	if y0 <= y1 {
		startX = x0
		startY = y0
		endX = x1
		endY = y1
		winding = 1
	} else {
		startX = x1
		startY = y1
		endX = x0
		endY = y0
		winding = -1
	}

	// Essentially, firstLine is floor(startY + 1) and lastLine is floor(endY).
	// These are refactored to integer casts in order to avoid function
	// calls. The difference with integer cast is that numbers are always
	// rounded towards zero. Since values smaller than zero get clipped away,
	// only coordinates between 0 and -1 require greater attention as they
	// also round to zero. The problems in this range can be avoided by
	// adding one to the values before conversion and subtracting after it.

	firstLine := int(startY + 1)
	lastLine := int(endY+1) - 1

	minClip := int(clipBound[1])
	maxClip := int(clipBound[3])

	// If start and end are on the same line, the edge doesn't cross
	// any lines and thus can be ignored.
	// If the end is smaller than the first line, edge is out.
	// If the start is larger than the last line, edge is out.
	if firstLine > lastLine || lastLine < minClip || firstLine >= maxClip {
		return false
	}

	// Adjust the start based on the target.
	if firstLine < minClip {
		firstLine = minClip
	}

	if lastLine >= maxClip {
		lastLine = maxClip - 1
	}
	edge.Slope = (endX - startX) / (endY - startY)
	edge.X = startX + (float64(firstLine)-startY)*edge.Slope
	edge.Winding = winding
	edge.FirstLine = firstLine
	edge.LastLine = lastLine

	return true
}

//! Creates a vertical polygon edge between two y values.
/*! Clips the edge vertically to the clip rectangle. Returns true for edges that
 *  should be rendered, false for others.
 */
func getVerticalEdge(startY, endY, x float64, edge *PolygonEdge, clipBound [4]float64) bool {
	var start, end float64
	var winding int16
	if startY < endY {
		start = startY
		end = endY
		winding = 1
	} else {
		start = endY
		end = startY
		winding = -1
	}

	firstLine := int(start + 1)
	lastLine := int(end+1) - 1

	minClip := int(clipBound[1])
	maxClip := int(clipBound[3])

	// If start and end are on the same line, the edge doesn't cross
	// any lines and thus can be ignored.
	// If the end is smaller than the first line, edge is out.
	// If the start is larger than the last line, edge is out.
	if firstLine > lastLine || lastLine < minClip || firstLine >= maxClip {
		return false
	}

	// Adjust the start based on the clip rect.
	if firstLine < minClip {
		firstLine = minClip
	}
	if lastLine >= maxClip {
		lastLine = maxClip - 1
	}

	edge.Slope = 0
	edge.X = x
	edge.Winding = winding
	edge.FirstLine = firstLine
	edge.LastLine = lastLine

	return true
}

type VertexData struct {
	X, Y      float64
	ClipFlags int
	Line      int
}

//! Calculates the edges of the polygon with transformation and clipping to edges array.
/*! Note that this may return upto three times the amount of edges that the polygon has vertices,
 *  in the unlucky case where both left and right side get clipped for all edges.
 *  \param edges the array for result edges. This should be able to contain 2*aVertexCount edges.
 *  \param aTransformation the transformation matrix for the polygon.
 *  \param aClipRectangle the clip rectangle.
 *  \return the amount of edges in the result.
 */
func (p Polygon) getScanEdges(edges []PolygonScanEdge, tr [6]float64, clipBound [4]float64) int {
	var n int
	vertexData := make([]VertexData, len(p)/2+1)
	for n = 0; n < len(vertexData)-1; n = n + 1 {
		k := n * 2
		vertexData[n].X = p[k]*tr[0] + p[k+1]*tr[2] + tr[4]
		vertexData[n].Y = p[k]*tr[1] + p[k+1]*tr[3] + tr[5]
		// Calculate clip flags for all vertices.
		vertexData[n].ClipFlags = POLYGON_CLIP_NONE
		if vertexData[n].X < clipBound[0] {
			vertexData[n].ClipFlags |= POLYGON_CLIP_LEFT
		} else if vertexData[n].X >= clipBound[2] {
			vertexData[n].ClipFlags |= POLYGON_CLIP_RIGHT
		}
		if vertexData[n].Y < clipBound[1] {
			vertexData[n].ClipFlags |= POLYGON_CLIP_TOP
		} else if vertexData[n].Y >= clipBound[3] {
			vertexData[n].ClipFlags |= POLYGON_CLIP_BOTTOM
		}

		// Calculate line of the vertex. If the vertex is clipped by top or bottom, the line
		// is determined by the clip rectangle.
		if vertexData[n].ClipFlags&POLYGON_CLIP_TOP != 0 {
			vertexData[n].Line = int(clipBound[1])
		} else if vertexData[n].ClipFlags&POLYGON_CLIP_BOTTOM != 0 {
			vertexData[n].Line = int(clipBound[3] - 1)
		} else {
			vertexData[n].Line = int(vertexData[n].Y+1) - 1
		}
	}

	// Copy the data from 0 to the last entry to make the data to loop.
	vertexData[len(vertexData)-1] = vertexData[0]

	// Transform the first vertex; store.
	// Process mVertexCount - 1 times, next is n+1
	// copy the first vertex to
	// Process 1 time, next is n

	edgeCount := 0
	for n = 0; n < len(vertexData)-1; n++ {
		clipSum := vertexData[n].ClipFlags | vertexData[n+1].ClipFlags
		clipUnion := vertexData[n].ClipFlags & vertexData[n+1].ClipFlags

		if clipUnion&(POLYGON_CLIP_TOP|POLYGON_CLIP_BOTTOM) == 0 &&
			vertexData[n].Line != vertexData[n+1].Line {
			var startIndex, endIndex int
			var winding int16
			if vertexData[n].Y < vertexData[n+1].Y {
				startIndex = n
				endIndex = n + 1
				winding = 1
			} else {
				startIndex = n + 1
				endIndex = n
				winding = -1
			}

			firstLine := vertexData[startIndex].Line + 1
			lastLine := vertexData[endIndex].Line

			if clipUnion&POLYGON_CLIP_RIGHT != 0 {
				// Both clip to right, edge is a vertical line on the right side
				edges[edgeCount].FirstLine = firstLine
				edges[edgeCount].LastLine = lastLine
				edges[edgeCount].Winding = winding
				edges[edgeCount].X = Fix(clipBound[2] * FIXED_FLOAT_COEF)
				edges[edgeCount].Slope = 0
				edges[edgeCount].SlopeFix = 0

				edgeCount++
			} else if clipUnion&POLYGON_CLIP_LEFT != 0 {
				// Both clip to left, edge is a vertical line on the left side
				edges[edgeCount].FirstLine = firstLine
				edges[edgeCount].LastLine = lastLine
				edges[edgeCount].Winding = winding
				edges[edgeCount].X = Fix(clipBound[0] * FIXED_FLOAT_COEF)
				edges[edgeCount].Slope = 0
				edges[edgeCount].SlopeFix = 0

				edgeCount++
			} else if clipSum&(POLYGON_CLIP_RIGHT|POLYGON_CLIP_LEFT) == 0 {
				// No clipping in the horizontal direction
				slope := (vertexData[endIndex].X -
					vertexData[startIndex].X) /
					(vertexData[endIndex].Y -
						vertexData[startIndex].Y)

					// If there is vertical clip (for the top) it will be processed here. The calculation
					// should be done for all non-clipping edges as well to determine the accurate position
					// where the edge crosses the first scanline.
				startx := vertexData[startIndex].X +
					(float64(firstLine)-vertexData[startIndex].Y)*slope

				edges[edgeCount].FirstLine = firstLine
				edges[edgeCount].LastLine = lastLine
				edges[edgeCount].Winding = winding
				edges[edgeCount].X = Fix(startx * FIXED_FLOAT_COEF)
				edges[edgeCount].Slope = Fix(slope * FIXED_FLOAT_COEF)

				if lastLine-firstLine >= SLOPE_FIX_STEP {
					edges[edgeCount].SlopeFix = Fix(slope*SLOPE_FIX_STEP*FIXED_FLOAT_COEF) -
						edges[edgeCount].Slope<<SLOPE_FIX_SHIFT
				} else {
					edges[edgeCount].SlopeFix = 0
				}

				edgeCount++
			} else {
				// Clips to left or right or both.
				slope := (vertexData[endIndex].X -
					vertexData[startIndex].X) /
					(vertexData[endIndex].Y -
						vertexData[startIndex].Y)

				// The edge may clip to both left and right.
				// The clip results in one or two new vertices, and one to three segments.
				// The rounding for scanlines may produce a result where any of the segments is
				// ignored.

				// The start is always above the end. Calculate the clip positions to clipVertices.
				// It is possible that only one of the vertices exist. This will be detected from the
				// clip flags of the vertex later, so they are initialized here.
				var clipVertices [2]VertexData

				if vertexData[startIndex].X <
					vertexData[endIndex].X {
					clipVertices[0].X = clipBound[0]
					clipVertices[1].X = clipBound[2]
					clipVertices[0].ClipFlags = POLYGON_CLIP_LEFT
					clipVertices[1].ClipFlags = POLYGON_CLIP_RIGHT
				} else {
					clipVertices[0].X = clipBound[2]
					clipVertices[1].X = clipBound[0]
					clipVertices[0].ClipFlags = POLYGON_CLIP_RIGHT
					clipVertices[1].ClipFlags = POLYGON_CLIP_LEFT
				}

				var p int
				for p = 0; p < 2; p++ {
					// Check if either of the vertices crosses the edge marked for the clip vertex
					if clipSum&clipVertices[p].ClipFlags != 0 {
						// The the vertex is required, calculate it.
						clipVertices[p].Y = vertexData[startIndex].Y +
							(clipVertices[p].X-
								vertexData[startIndex].X)/slope

						// If there is clipping in the vertical direction, the new vertex may be clipped.
						if clipSum&(POLYGON_CLIP_TOP|POLYGON_CLIP_BOTTOM) != 0 {
							if clipVertices[p].Y < clipBound[1] {
								clipVertices[p].ClipFlags = POLYGON_CLIP_TOP
								clipVertices[p].Line = int(clipBound[1])
							} else if clipVertices[p].Y > clipBound[3] {
								clipVertices[p].ClipFlags = POLYGON_CLIP_BOTTOM
								clipVertices[p].Line = int(clipBound[3] - 1)
							} else {
								clipVertices[p].ClipFlags = 0
								clipVertices[p].Line = int(clipVertices[p].Y+1) - 1
							}
						} else {
							clipVertices[p].ClipFlags = 0
							clipVertices[p].Line = int(clipVertices[p].Y+1) - 1
						}
					}
				}

				// Now there are three or four vertices, in the top-to-bottom order of start, clip0, clip1,
				// end. What kind of edges are required for connecting these can be determined from the
				// clip flags.
				// -if clip vertex has horizontal clip flags, it doesn't exist. No edge is generated.
				// -if start vertex or end vertex has horizontal clip flag, the edge to/from the clip vertex is vertical
				// -if the line of two vertices is the same, the edge is not generated, since the edge doesn't
				//  cross any scanlines.

				// The alternative patterns are:
				// start - clip0 - clip1 - end
				// start - clip0 - end
				// start - clip1 - end

				var topClipIndex, bottomClipIndex int
				if (clipVertices[0].ClipFlags|clipVertices[1].ClipFlags)&
					(POLYGON_CLIP_LEFT|POLYGON_CLIP_RIGHT) == 0 {
					// Both sides are clipped, the order is start-clip0-clip1-end
					topClipIndex = 0
					bottomClipIndex = 1

					// Add the edge from clip0 to clip1
					// Check that the line is different for the vertices.
					if clipVertices[0].Line != clipVertices[1].Line {
						firstClipLine := clipVertices[0].Line + 1

						startx := vertexData[startIndex].X +
							(float64(firstClipLine)-vertexData[startIndex].Y)*slope

						edges[edgeCount].X = Fix(startx * FIXED_FLOAT_COEF)
						edges[edgeCount].Slope = Fix(slope * FIXED_FLOAT_COEF)
						edges[edgeCount].FirstLine = firstClipLine
						edges[edgeCount].LastLine = clipVertices[1].Line
						edges[edgeCount].Winding = winding

						if edges[edgeCount].LastLine-edges[edgeCount].FirstLine >= SLOPE_FIX_STEP {
							edges[edgeCount].SlopeFix = Fix(slope*SLOPE_FIX_STEP*FIXED_FLOAT_COEF) -
								edges[edgeCount].Slope<<SLOPE_FIX_SHIFT
						} else {
							edges[edgeCount].SlopeFix = 0
						}

						edgeCount++
					}
				} else {
					// Clip at either side, check which side. The clip flag is on for the vertex
					// that doesn't exist, i.e. has not been clipped to be inside the rect.
					if clipVertices[0].ClipFlags&(POLYGON_CLIP_LEFT|POLYGON_CLIP_RIGHT) != 0 {
						topClipIndex = 1
						bottomClipIndex = 1
					} else {
						topClipIndex = 0
						bottomClipIndex = 0
					}
				}

				// Generate the edges from start - clip top and clip bottom - end
				// Clip top and clip bottom may be the same vertex if there is only one 
				// clipped vertex.

				// Check that the line is different for the vertices.
				if vertexData[startIndex].Line != clipVertices[topClipIndex].Line {
					edges[edgeCount].FirstLine = firstLine
					edges[edgeCount].LastLine = clipVertices[topClipIndex].Line
					edges[edgeCount].Winding = winding

					// If startIndex is clipped, the edge is a vertical one.
					if vertexData[startIndex].ClipFlags&(POLYGON_CLIP_LEFT|POLYGON_CLIP_RIGHT) != 0 {
						edges[edgeCount].X = Fix(clipVertices[topClipIndex].X * FIXED_FLOAT_COEF)
						edges[edgeCount].Slope = 0
						edges[edgeCount].SlopeFix = 0
					} else {
						startx := vertexData[startIndex].X +
							(float64(firstLine)-vertexData[startIndex].Y)*slope

						edges[edgeCount].X = Fix(startx * FIXED_FLOAT_COEF)
						edges[edgeCount].Slope = Fix(slope * FIXED_FLOAT_COEF)

						if edges[edgeCount].LastLine-edges[edgeCount].FirstLine >= SLOPE_FIX_STEP {
							edges[edgeCount].SlopeFix = Fix(slope*SLOPE_FIX_STEP*FIXED_FLOAT_COEF) -
								edges[edgeCount].Slope<<SLOPE_FIX_SHIFT
						} else {
							edges[edgeCount].SlopeFix = 0
						}
					}

					edgeCount++
				}

				// Check that the line is different for the vertices.
				if clipVertices[bottomClipIndex].Line != vertexData[endIndex].Line {
					firstClipLine := clipVertices[bottomClipIndex].Line + 1

					edges[edgeCount].FirstLine = firstClipLine
					edges[edgeCount].LastLine = lastLine
					edges[edgeCount].Winding = winding

					// If endIndex is clipped, the edge is a vertical one.
					if vertexData[endIndex].ClipFlags&(POLYGON_CLIP_LEFT|POLYGON_CLIP_RIGHT) != 0 {
						edges[edgeCount].X = Fix(clipVertices[bottomClipIndex].X * FIXED_FLOAT_COEF)
						edges[edgeCount].Slope = 0
						edges[edgeCount].SlopeFix = 0
					} else {
						startx := vertexData[startIndex].X +
							(float64(firstClipLine)-vertexData[startIndex].Y)*slope

						edges[edgeCount].X = Fix(startx * FIXED_FLOAT_COEF)
						edges[edgeCount].Slope = Fix(slope * FIXED_FLOAT_COEF)

						if edges[edgeCount].LastLine-edges[edgeCount].FirstLine >= SLOPE_FIX_STEP {
							edges[edgeCount].SlopeFix = Fix(slope*SLOPE_FIX_STEP*FIXED_FLOAT_COEF) -
								edges[edgeCount].Slope<<SLOPE_FIX_SHIFT
						} else {
							edges[edgeCount].SlopeFix = 0
						}
					}

					edgeCount++
				}

			}
		}
	}

	return edgeCount
}
