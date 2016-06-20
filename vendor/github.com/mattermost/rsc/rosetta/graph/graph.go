// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Simple demonstration of a graph interface and
// Dijkstra's algorithm built on top of that interface,
// without using inheritance.

package graph

import "container/heap"

// A Graph is the interface implemented by graphs that
// this package can run algorithms on.
type Graph interface {
	// NumVertex returns the number of vertices in the graph.
	NumVertex() int

	// VertexID returns a vertex ID, 0 <= ID < NumVertex(), for v.
	VertexID(v Vertex) int

	// Neighbors returns a slice of vertices that are adjacent
	// to v in the graph.
	Neighbors(v Vertex) []Vertex
}

type Vertex interface {
	String() string
}

// ShortestPath uses Dijkstra's algorithm to find the shortest
// path from start to end in g.  It returns the path as a slice of
// vertices, with start first and end last.  If there is no path,
// ShortestPath returns nil.
func ShortestPath(g Graph, start, end Vertex) []Vertex {
	d := newDijkstra(g)

	d.visit(start, 1, nil)
	for !d.empty() {
		p := d.next()
		if g.VertexID(p.v) == g.VertexID(end) {
			break
		}
		for _, v := range g.Neighbors(p.v) {
			d.visit(v, p.depth+1, p)
		}
	}

	p := d.pos(end)
	if p.depth == 0 {
		// unvisited - no path
		return nil
	}
	path := make([]Vertex, p.depth)
	for ; p != nil; p = p.parent {
		path[p.depth-1] = p.v
	}
	return path
}

// A dpos is a position in the Dijkstra traversal.
type dpos struct {
	depth     int
	heapIndex int
	v         Vertex
	parent    *dpos
}

// A dijkstra is the Dijkstra traversal's work state.
// It contains the heap queue and per-vertex information.
type dijkstra struct {
	g    Graph
	q    []*dpos
	byID []dpos
}

func newDijkstra(g Graph) *dijkstra {
	d := &dijkstra{g: g}
	d.byID = make([]dpos, g.NumVertex())
	return d
}

func (d *dijkstra) pos(v Vertex) *dpos {
	p := &d.byID[d.g.VertexID(v)]
	p.v = v // in case this is the first time we've seen it
	return p
}

func (d *dijkstra) visit(v Vertex, depth int, parent *dpos) {
	p := d.pos(v)
	if p.depth == 0 {
		p.parent = parent
		p.depth = depth
		heap.Push(d, p)
	}
}

func (d *dijkstra) empty() bool {
	return len(d.q) == 0
}

func (d *dijkstra) next() *dpos {
	return heap.Pop(d).(*dpos)
}

// Implementation of heap.Interface
func (d *dijkstra) Len() int {
	return len(d.q)
}

func (d *dijkstra) Less(i, j int) bool {
	return d.q[i].depth < d.q[j].depth
}

func (d *dijkstra) Swap(i, j int) {
	d.q[i], d.q[j] = d.q[j], d.q[i]
	d.q[i].heapIndex = i
	d.q[j].heapIndex = j
}

func (d *dijkstra) Push(x interface{}) {
	p := x.(*dpos)
	p.heapIndex = len(d.q)
	d.q = append(d.q, p)
}

func (d *dijkstra) Pop() interface{} {
	n := len(d.q)
	x := d.q[n-1]
	d.q = d.q[:n-1]
	x.heapIndex = -1
	return x
}
