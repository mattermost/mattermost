// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package proto defines the protocol between appfs client and server.
package proto

import "time"

// An Auth appears, JSON-encoded, as the X-Appfs-Auth header line,
// to authenticate a request made to the file server.
// The authentication scheme could be made more sophisticated, but since
// we are already forcing the use of TLS, a plain password is fine for now.
type Auth struct {
	Password string
}

// GET /.appfs/stat/path returns the metadata for a file or directory,
// a JSON-encoded FileInfo.
const StatURL = "/.appfs/stat/"

// GET /.appfs/read/path returns the content of the file or directory.
// The body of the response is the raw file or directory content.
// The content of a directory is a sequence of JSON-encoded FileInfo.
const ReadURL = "/.appfs/read/"

// POST to /.appfs/write/path writes new data to a file.
// The X-Appfs-SHA1 header is the SHA1 hash of the data.
// The body of the request is the raw file content.
const WriteURL = "/.appfs/write/"

// POST to /.appfs/mount initializes the file system if it does not
// yet exist in the datastore.
const MkfsURL = "/.appfs/mkfs"

// POST to /.appfs/create/path creates a new file or directory.
// The named path must not already exist; its parent must exist.
// The query parameter dir=1 indicates that a directory should be created.
const CreateURL = "/.appfs/create/"

// POST to /.appfs/remove/path removes the file or directory.
// A directory must be empty to be removed.
const RemoveURL = "/.appfs/remove/"

// A FileInfo is a directory entry.
type FileInfo struct {
	Name    string // final path element
	ModTime time.Time
	Size    int64
	IsDir   bool
}

// PostContentType is the Content-Type for POSTed data.
// There is no encoding or framing: it is just raw data bytes.
const PostContentType = "x-appfs/raw"
