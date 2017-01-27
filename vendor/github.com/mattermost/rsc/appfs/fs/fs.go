// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package fs is an indirection layer, allowing code to use a
// file system without knowing whether it is the host file system
// (running without App Engine) or the datastore-based app
// file system (running on App Engine).
//
// When compiled locally, fs refers to files in the local file system,
// and the cache saves nothing.
//
// When compiled for App Engine, fs uses the appfs file system
// and the memcache-based cache.
package fs

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/rsc/appfs/proto"
)

type AppEngine interface {
	NewContext(req *http.Request) interface{}
	CacheRead(ctxt interface{}, name, path string) (key interface{}, data []byte, found bool)
	CacheWrite(ctxt, key interface{}, data []byte)
	Read(ctxt interface{}, path string) ([]byte, *proto.FileInfo, error)
	Write(ctxt interface{}, path string, data []byte) error
	Remove(ctxt interface{}, path string) error
	Mkdir(ctxt interface{}, path string) error
	ReadDir(ctxt interface{}, path string) ([]proto.FileInfo, error)
	Criticalf(ctxt interface{}, format string, args ...interface{})
	User(ctxt interface{}) string
}

var ae AppEngine

func Register(impl AppEngine) {
	ae = impl
}	

// Root is the root of the local file system.  It has no effect on App Engine.
var Root = "."

// A Context is an opaque context that is needed to perform file system
// operations.  Each context is associated with a single HTTP request.
type Context struct {
	context
	ae interface{}
}

// NewContext returns a context associated with the given HTTP request.
func NewContext(req *http.Request) *Context {
	if ae != nil {
		ctxt := ae.NewContext(req)
		return &Context{ae: ctxt}
	}
	return newContext(req)
}

// A CacheKey is an opaque cache key that can be used to store new entries
// in the cache.  To ensure that the cache remains consistent with the underlying
// file system, the correct procedure is:
//
// 1. Use CacheRead (or CacheLoad) to attempt to load the entry.  If it succeeds, use it.
// If not, continue, saving the CacheKey.
//
// 2. Read from the file system and construct the entry that would have
// been in the cache.  In order to be consistent, all the file system reads
// should only refer to parts of the file system in the tree rooted at the path
// passed to CacheRead.
//
// 3. Save the entry using CacheWrite (or CacheStore), using the key that was
// created by the CacheRead (or CacheLoad) executed before reading from the
// file system.
//
type CacheKey struct {
	cacheKey
	ae interface{}
}

// CacheRead reads from cache the entry with the given name and path.
// The path specifies the scope of information stored in the cache entry.
// An entry is invalidated by a write to any location in the file tree rooted at path.
// The name is an uninterpreted identifier to distinguish the cache entry
// from other entries using the same path.
//
// If it finds a cache entry, CacheRead returns the data and found=true.
// If it does not find a cache entry, CacheRead returns data=nil and found=false.
// Either way, CacheRead returns an appropriate cache key for storing to the
// cache entry using CacheWrite.
func (c *Context) CacheRead(name, path string) (ckey CacheKey, data []byte, found bool) {
	if ae != nil {
		key, data, found := ae.CacheRead(c.ae, name, path)
		return CacheKey{ae: key}, data, found
	}
	return c.cacheRead(ckey, path)
}

// CacheLoad uses CacheRead to load gob-encoded data and decodes it into value.
func (c *Context) CacheLoad(name, path string, value interface{}) (ckey CacheKey, found bool) {
	ckey, data, found := c.CacheRead(name, path)
	if found {
		if err := gob.NewDecoder(bytes.NewBuffer(data)).Decode(value); err != nil {
			c.Criticalf("gob Decode: %v", err)
			found = false
		}
	}
	return
}

// CacheWrite writes an entry to the cache with the given key, path, and data.
// The cache entry will be invalidated the next time the file tree rooted at path is
// modified in anyway.
func (c *Context) CacheWrite(ckey CacheKey, data []byte) {
	if ae != nil {
		ae.CacheWrite(c.ae, ckey.ae, data)
		return
	}
	c.cacheWrite(ckey, data)
}

// CacheStore uses CacheWrite to save the gob-encoded form of value.
func (c *Context) CacheStore(ckey CacheKey, value interface{}) {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(value); err != nil {
		c.Criticalf("gob Encode: %v", err)
		return
	}
	c.CacheWrite(ckey, buf.Bytes())
}

// Read returns the data associated with the file named by path.
// It is a copy and can be modified without affecting the file.
func (c *Context) Read(path string) ([]byte, *proto.FileInfo, error) {
	if ae != nil {
		return ae.Read(c.ae, path)
	}
	return c.read(path)
}

// Write replaces the data associated with the file named by path.
func (c *Context) Write(path string, data []byte) error {
	if ae != nil {
		return ae.Write(c.ae, path, data)
	}
	return c.write(path, data)
}

// Remove removes the file named by path.
func (c *Context) Remove(path string) error {
	if ae != nil {
		return ae.Remove(c.ae, path)
	}
	return c.remove(path)
}

// Mkdir creates a directory with the given path.
// If the path already exists and is a directory, Mkdir returns no error.
func (c *Context) Mkdir(path string) error {
	if ae != nil {
		return ae.Mkdir(c.ae, path)
	}
	return c.mkdir(path)
}

// ReadDir returns the contents of the directory named by the path.
func (c *Context) ReadDir(path string) ([]proto.FileInfo, error) {
	if ae != nil {
		return ae.ReadDir(c.ae, path)
	}
	return c.readdir(path)
}

// ServeFile serves the named file as the response to the HTTP request.
func (c *Context) ServeFile(w http.ResponseWriter, req *http.Request, name string) {
	root := &httpFS{c, name}
	http.FileServer(root).ServeHTTP(w, req)
}

// Criticalf logs the message at critical priority.
func (c *Context) Criticalf(format string, args ...interface{}) {
	if ae != nil {
		ae.Criticalf(c.ae, format, args...)
	}
	log.Printf(format, args...)
}

// User returns the name of the user running the request.
func (c *Context) User() string {
	if ae != nil {
		return ae.User(c.ae)
	}
	return os.Getenv("USER")
}

type httpFS struct {
	c    *Context
	name string
}

type httpFile struct {
	data []byte
	fi   *proto.FileInfo
	off  int
}

func (h *httpFS) Open(_ string) (http.File, error) {
	data, fi, err := h.c.Read(h.name)
	if err != nil {
		return nil, err
	}
	return &httpFile{data, fi, 0}, nil
}

func (f *httpFile) Close() error {
	return nil
}

type fileInfo struct {
	p *proto.FileInfo
}

func (f *fileInfo) IsDir() bool        { return f.p.IsDir }
func (f *fileInfo) Name() string       { return f.p.Name }
func (f *fileInfo) ModTime() time.Time { return f.p.ModTime }
func (f *fileInfo) Size() int64        { return f.p.Size }
func (f *fileInfo) Sys() interface{} { return f.p }
func (f *fileInfo) Mode() os.FileMode {
	if f.p.IsDir {
		return os.ModeDir | 0777
	}
	return 0666
}

func (f *httpFile) Stat() (os.FileInfo, error) {
	return &fileInfo{f.fi}, nil
}

func (f *httpFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, fmt.Errorf("no directory")
}

func (f *httpFile) Read(data []byte) (int, error) {
	if f.off >= len(f.data) {
		return 0, io.EOF
	}
	n := copy(data, f.data[f.off:])
	f.off += n
	return n, nil
}

func (f *httpFile) Seek(offset int64, whence int) (int64, error) {
	off := int(offset)
	if int64(off) != offset {
		return 0, fmt.Errorf("invalid offset")
	}
	switch whence {
	case 1:
		off += f.off
	case 2:
		off += len(f.data)
	}
	f.off = off
	return int64(off), nil
}
