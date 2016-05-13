// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fs

import (
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/mattermost/rsc/appfs/proto"
)

type context struct{}

type cacheKey struct{}

func newContext(req *http.Request) *Context {
	return &Context{}
}

func (*context) cacheRead(ckey CacheKey, path string) (CacheKey, []byte, bool) {
	return ckey, nil, false
}

func (*context) cacheWrite(ckey CacheKey, data []byte) {
}

func (*context) read(path string) ([]byte, *proto.FileInfo, error) {
	p := filepath.Join(Root, path)
	dir, err := os.Stat(p)
	if err != nil {
		return nil, nil, err
	}
	fi := &proto.FileInfo{
		Name:    dir.Name(),
		ModTime: dir.ModTime(),
		Size:    dir.Size(),
		IsDir:   dir.IsDir(),
	}
	data, err := ioutil.ReadFile(p)
	return data, fi, err
}

func (*context) write(path string, data []byte) error {
	p := filepath.Join(Root, path)
	return ioutil.WriteFile(p, data, 0666)
}

func (*context) remove(path string) error {
	p := filepath.Join(Root, path)
	return os.Remove(p)
}

func (*context) mkdir(path string) error {
	p := filepath.Join(Root, path)
	fi, err := os.Stat(p)
	if err == nil && fi.IsDir() {
		return nil
	}
	return os.Mkdir(p, 0777)
}

func (*context) readdir(path string) ([]proto.FileInfo, error) {
	p := filepath.Join(Root, path)
	dirs, err := ioutil.ReadDir(p)
	if err != nil {
		return nil, err
	}
	var out []proto.FileInfo
	for _, dir := range dirs {
		out = append(out, proto.FileInfo{
			Name:    dir.Name(),
			ModTime: dir.ModTime(),
			Size:    dir.Size(),
			IsDir:   dir.IsDir(),
		})
	}
	return out, nil
}
