// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Rosetta Code-inspired maze generator and solver.
// Demonstrates use of interfaces to separate algorithm
// implementations (graph.ShortestPath, heap.*) from data.
// (In contrast, multiple inheritance approaches require
// you to store their data in your data structures as part
// of the inheritance.)

package main

import (
	"bytes"
	"fmt"
	"math/rand"
	"time"

	"github.com/mattermost/rsc/rosetta/graph"
)

type Maze struct {
	w, h int
	grid [][]walls
}

type Dir uint

const (
	North Dir = iota
	East
	West
	South
)

type walls uint8

const allWalls walls = 1<<North | 1<<East | 1<<South | 1<<West

var dirs = []struct {
	δx, δy int
}{
	{0, -1},
	{1, 0},
	{-1, 0},
	{0, 1},
}

// move returns the cell in the direction dir from position r, c.
// It returns ok==false if there is no cell in that direction.
func (m *Maze) move(x, y int, dir Dir) (nx, ny int, ok bool) {
	nx = x + dirs[dir].δx
	ny = y + dirs[dir].δy
	ok = 0 <= nx && nx < m.w && 0 <= ny && ny < m.h
	return
}

// Move returns the cell in the direction dir from position x, y
// It returns ok==false if there is no cell in that direction
// or if a wall blocks movement in that direction.
func (m *Maze) Move(x, y int, dir Dir) (nx, ny int, ok bool) {
	nx, ny, ok = m.move(x, y, dir)
	ok = ok && m.grid[y][x]&(1<<dir) == 0
	return
}

// NewMaze returns a new, randomly generated maze
// of width w and height h.
func NewMaze(w, h int) *Maze {
	// Allocate one slice for the whole 2-d cell grid and break up into rows.
	all := make([]walls, w*h)
	for i := range all {
		all[i] = allWalls
	}
	m := &Maze{w: w, h: h, grid: make([][]walls, h)}
	for i := range m.grid {
		m.grid[i], all = all[:w], all[w:]
	}

	// All cells start with all walls.
	m.generate(rand.Intn(w), rand.Intn(h))

	return m
}

func (m *Maze) generate(x, y int) {
	i := rand.Intn(4)
	for j := 0; j < 4; j++ {
		dir := Dir(i+j) % 4
		if nx, ny, ok := m.move(x, y, dir); ok && m.grid[ny][nx] == allWalls {
			// break down wall
			m.grid[y][x] &^= 1 << dir
			m.grid[ny][nx] &^= 1 << (3 - dir)
			m.generate(nx, ny)
		}
	}
}

// String returns a multi-line string representation of the maze.
func (m *Maze) String() string {
	return m.PathString(nil)
}

// PathString returns the multi-line string representation of the
// maze with the path marked on it.
func (m *Maze) PathString(path []graph.Vertex) string {
	var b bytes.Buffer
	wall := func(w, m walls, ch byte) {
		if w&m != 0 {
			b.WriteByte(ch)
		} else {
			b.WriteByte(' ')
		}
	}
	for _, row := range m.grid {
		b.WriteByte('+')
		for _, cell := range row {
			wall(cell, 1<<North, '-')
			b.WriteByte('+')
		}
		b.WriteString("\n")
		for _, cell := range row {
			wall(cell, 1<<West, '|')
			b.WriteByte(' ')
		}
		b.WriteString("|\n")
	}
	for i := 0; i < m.w; i++ {
		b.WriteString("++")
	}
	b.WriteString("+")
	grid := b.Bytes()

	// Overlay path.
	last := -1
	for _, v := range path {
		p := v.(pos)
		i := (2*m.w+2)*(2*p.y+1) + 2*p.x + 1
		grid[i] = '#'
		if last != -1 {
			grid[(i+last)/2] = '#'
		}
		last = i
	}

	return string(grid)
}

// Implement graph.Graph.

type pos struct {
	x, y int
}

func (p pos) String() string {
	return fmt.Sprintf("%d,%d", p.x, p.y)
}

func (m *Maze) Neighbors(v graph.Vertex) []graph.Vertex {
	p := v.(pos)
	var neighbors []graph.Vertex
	for dir := North; dir <= South; dir++ {
		if nx, ny, ok := m.Move(p.x, p.y, dir); ok {
			neighbors = append(neighbors, pos{nx, ny})
		}
	}
	return neighbors
}

func (m *Maze) NumVertex() int {
	return m.w * m.h
}

func (m *Maze) VertexID(v graph.Vertex) int {
	p := v.(pos)
	return p.y*m.w + p.x
}

func (m *Maze) Vertex(x, y int) graph.Vertex {
	return pos{x, y}
}

func main() {
	const w, h = 30, 10
	rand.Seed(time.Now().UnixNano())

	m := NewMaze(w, h)
	path := graph.ShortestPath(m, m.Vertex(0, 0), m.Vertex(w-1, h-1))
	fmt.Println(m.PathString(path))
}
