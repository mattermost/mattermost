// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Hellofs implements a simple "hello world" file system.
package main

import (
	"log"
	"os"

	"github.com/mattermost/rsc/fuse"
)

func main() {
	c, err := fuse.Mount("/mnt/hellofs")
	if err != nil {
		log.Fatal(err)
	}

	c.Serve(FS{})
}

// FS implements the hello world file system.
type FS struct{}

func (FS) Root() (fuse.Node, fuse.Error) {
	return Dir{}, nil
}

// Dir implements both Node and Handle for the root directory.
type Dir struct{}

func (Dir) Attr() fuse.Attr {
	return fuse.Attr{Mode: os.ModeDir | 0555}
}

func (Dir) Lookup(name string, intr fuse.Intr) (fuse.Node, fuse.Error) {
	if name == "hello" {
		return File{}, nil
	}
	return nil, fuse.ENOENT
}

var dirDirs = []fuse.Dirent{
	{Inode: 2, Name: "hello", Type: 0},
}

func (Dir) ReadDir(intr fuse.Intr) ([]fuse.Dirent, fuse.Error) {
	return dirDirs, nil
}

// File implements both Node and Handle for the hello file.
type File struct{}

func (File) Attr() fuse.Attr {
	return fuse.Attr{Mode: 0444}
}

func (File) ReadAll(intr fuse.Intr) ([]byte, fuse.Error) {
	return []byte("hello, world\n"), nil
}
