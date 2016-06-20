// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// FUSE directory tree, for servers that wish to use it with the service loop.

package fuse

import (
	"os"
	pathpkg "path"
	"strings"
)

// A Tree implements a basic directory tree for FUSE.
type Tree struct {
	tree
}

func (t *Tree) Root() (Node, Error) {
	return &t.tree, nil
}

// Add adds the path to the tree, resolving to the given node.
// If path or a prefix of path has already been added to the tree,
// Add panics.
func (t *Tree) Add(path string, node Node) {
	path = pathpkg.Clean("/" + path)[1:]
	elems := strings.Split(path, "/")
	dir := Node(&t.tree)
	for i, elem := range elems {
		dt, ok := dir.(*tree)
		if !ok {
			panic("fuse: Tree.Add for " + strings.Join(elems[:i], "/") + " and " + path)
		}
		n := dt.lookup(elem)
		if n != nil {
			if i+1 == len(elems) {
				panic("fuse: Tree.Add for " + path + " conflicts with " + elem)
			}
			dir = n
		} else {
			if i+1 == len(elems) {
				dt.add(elem, node)
			} else {
				dir = &tree{}
				dt.add(elem, dir)
			}
		}
	}
}

type treeDir struct {
	name string
	node Node
}

type tree struct {
	dir []treeDir
}

func (t *tree) lookup(name string) Node {
	for _, d := range t.dir {
		if d.name == name {
			return d.node
		}
	}
	return nil
}

func (t *tree) add(name string, n Node) {
	t.dir = append(t.dir, treeDir{name, n})
}

func (t *tree) Attr() Attr {
	return Attr{Mode: os.ModeDir | 0555}
}

func (t *tree) Lookup(name string, intr Intr) (Node, Error) {
	n := t.lookup(name)
	if n != nil {
		return n, nil
	}
	return nil, ENOENT
}

func (t *tree) ReadDir(intr Intr) ([]Dirent, Error) {
	var out []Dirent
	for _, d := range t.dir {
		out = append(out, Dirent{Name: d.name})
	}
	return out, nil
}
