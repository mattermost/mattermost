// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package server implements an appfs server backed by the 
// App Engine datastore.
package server

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"appengine"
	"appengine/datastore"
	"appengine/memcache"
	"appengine/user"

	"github.com/mattermost/rsc/appfs/fs"
	"github.com/mattermost/rsc/appfs/proto"
)

const pwFile = "/.password"
var chatty = false

func init() {
	handle(proto.ReadURL, (*request).read)
	handle(proto.WriteURL, (*request).write)
	handle(proto.StatURL, (*request).stat)
	handle(proto.MkfsURL, (*request).mkfs)
	handle(proto.CreateURL, (*request).create)
	handle(proto.RemoveURL, (*request).remove)
}

type request struct {
	w     http.ResponseWriter
	req   *http.Request
	c     appengine.Context
	name  string
	mname string
	key   *datastore.Key
}

func auth(r *request) bool {
	hdr := r.req.Header.Get("Authorization")
	if !strings.HasPrefix(hdr, "Basic ") {
		return false
	}
	data, err := base64.StdEncoding.DecodeString(hdr[6:])
	if err != nil {
		return false
	}
	i := bytes.IndexByte(data, ':')
	if i < 0 {
		return false
	}
	user, passwd := string(data[:i]), string(data[i+1:])
	
	_, data, err = read(r.c, pwFile)
	if err != nil {
		r.c.Errorf("reading %s: %v", pwFile, err)
		if _, err := mkfs(r.c); err != nil {
			r.c.Errorf("creating fs: %v", err)
		}
		_, data, err = read(r.c, pwFile)
		if err != nil {
			r.c.Errorf("reading %s again: %v", pwFile, err)
			return false
		}
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "#") {
			continue
		}
		f := strings.Fields(line)
		if len(f) < 3 {
			continue
		}
		if f[0] == user {
			return hash(f[1]+passwd) == f[2]
		}
	}
	return false
}

func hash(s string) string {
	h := sha1.New()
	h.Write([]byte(s))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func handle(prefix string, f func(*request)) {
	http.HandleFunc(prefix, func(w http.ResponseWriter, req *http.Request) {
		c := appengine.NewContext(req)
		r := &request{
			w:   w,
			req: req,
			c:   c,
		}

		if strings.HasSuffix(prefix, "/") {
			r.name, r.mname, r.key = mangle(c, req.URL.Path[len(prefix)-1:])
		} else {
			req.URL.Path = "/"
		}
		defer func() {
			if err := recover(); err != nil {
				w.WriteHeader(http.StatusConflict)
				fmt.Fprintf(w, "%s\n", err)
			}
		}()

		if !auth(r) {
			w.Header().Set("WWW-Authenticate", "Basic realm=\"appfs\"")
			http.Error(w, "Need auth", http.StatusUnauthorized)
			return
		}

		f(r)
	})
}

func mangle(c appengine.Context, name string) (string, string, *datastore.Key) {
	name = path.Clean("/" + name)
	n := strings.Count(name, "/")
	if name == "/" {
		n = 0
	}
	mname := fmt.Sprintf("%d%s", n, name)
	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	key := datastore.NewKey(c, "FileInfo", mname, 0, root)
	return name, mname, key
}

type FileInfo struct {
	Path    string // mangled path
	Name    string
	Qid     int64 // assigned unique id number
	Seq     int64 // modification sequence number in file tree
	ModTime time.Time
	Size    int64
	IsDir   bool
}

type FileData struct {
	Data []byte
}

func stat(c appengine.Context, name string) (*FileInfo, error) {
	var fi FileInfo
	name, _, key := mangle(c, name)
	c.Infof("DATASTORE Stat %q", name)
	err := datastore.Get(c, key, &fi)
	if err != nil {
		return nil, err
	}
	return &fi, nil
}

func (r *request) saveStat(fi *FileInfo) {
	jfi, err := json.Marshal(&fi)
	if err != nil {
		panic(err)
	}
	r.w.Header().Set("X-Appfs-Stat", string(jfi))
}

func (r *request) tx(f func(c appengine.Context) error) {
	err := datastore.RunInTransaction(r.c, f, &datastore.TransactionOptions{XG: true})
	if err != nil {
		panic(err)
	}
}

func (r *request) stat() {
	var fi *FileInfo
	r.tx(func(c appengine.Context) error {
		fi1, err := stat(c, r.name)
		if err != nil {
			return err
		}
		fi = fi1
		return nil
	})

	jfi, err := json.Marshal(&fi)
	if err != nil {
		panic(err)
	}
	r.w.Write(jfi)
}

func read(c appengine.Context, name string) (fi *FileInfo, data []byte, err error) {
	name, _, _ = mangle(c, name)
	fi1, err := stat(c, name)
	if err != nil {
		return nil, nil, err
	}
	if fi1.IsDir {
		dt, err := readdir(c, name)
		if err != nil {
			return nil, nil, err
		}
		fi = fi1
		data = dt
		return fi, data, nil
	}

	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	dkey := datastore.NewKey(c, "FileData", "", fi1.Qid, root)
	var fd FileData
	c.Infof("DATASTORE Read %q", name)
	if err := datastore.Get(c, dkey, &fd); err != nil {
		return nil, nil, err
	}
	fi = fi1
	data = fd.Data
	return fi, data, nil
}

func (r *request) read() {
	var (
		fi *FileInfo
		data []byte
	)
	r.tx(func(c appengine.Context) error {
		var err error
		fi, data, err = read(r.c, r.name)
		return err
	})
	r.saveStat(fi)
	r.w.Write(data)
}

func readdir(c appengine.Context, name string) ([]byte, error) {
	name, _, _ = mangle(c, name)
	var buf bytes.Buffer

	n := strings.Count(name, "/")
	if name == "/" {
		name = ""
		n = 0
	}
	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	first := fmt.Sprintf("%d%s/", n+1, name)
	limit := fmt.Sprintf("%d%s0", n+1, name)
	c.Infof("DATASTORE ReadDir %q", name)
	q := datastore.NewQuery("FileInfo").
		Filter("Path >=", first).
		Filter("Path <", limit).
		Ancestor(root)
	enc := json.NewEncoder(&buf)
	it := q.Run(c)
	var fi FileInfo
	var pfi proto.FileInfo
	for {
		fi = FileInfo{}
		_, err := it.Next(&fi)
		if err != nil {
			if err == datastore.Done {
				break
			}
			return nil, err
		}
		pfi = proto.FileInfo{
			Name:    fi.Name,
			ModTime: fi.ModTime,
			Size:    fi.Size,
			IsDir:   fi.IsDir,
		}
		if err := enc.Encode(&pfi); err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func readdirRaw(c appengine.Context, name string) ([]proto.FileInfo, error) {
	name, _, _ = mangle(c, name)
	n := strings.Count(name, "/")
	if name == "/" {
		name = ""
		n = 0
	}
	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	first := fmt.Sprintf("%d%s/", n+1, name)
	limit := fmt.Sprintf("%d%s0", n+1, name)
	c.Infof("DATASTORE ReadDir %q", name)
	q := datastore.NewQuery("FileInfo").
		Filter("Path >=", first).
		Filter("Path <", limit).
		Ancestor(root)
	it := q.Run(c)
	var fi FileInfo
	var pfi proto.FileInfo
	var out []proto.FileInfo
	for {
		fi = FileInfo{}
		_, err := it.Next(&fi)
		if err != nil {
			if err == datastore.Done {
				break
			}
			return nil, err
		}
		pfi = proto.FileInfo{
			Name:    fi.Name,
			ModTime: fi.ModTime,
			Size:    fi.Size,
			IsDir:   fi.IsDir,
		}
		out = append(out, pfi)
	}
println("READDIR", name, len(out))
	return out, nil
}


var initPasswd = `# Password file
# This file controls access to the server.
# The format is lines of space-separated fields:
#	user salt pwhash
# The pwhash is the SHA1 of the salt string concatenated with the password.

# user=dummy password=dummy (replace with your own entries)
dummy 12345 faa863c7d3d41893f80165c704b714d5e31bdd3b
`

func (r *request) mkfs() {
	var fi *FileInfo
	r.tx(func(c appengine.Context) error {
		var err error
		fi, err = mkfs(c)
		return err
	})
	r.saveStat(fi)
}

func mkfs(c appengine.Context) (fi *FileInfo, err error) {
	fi1, err := stat(c, "/")
	if err == nil {
		return fi1, nil
	}

	// Root needs to be created.
	// Probably root key does too.
	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	_, err = datastore.Put(c, root, &struct{}{})
	if err != nil {
		return nil, fmt.Errorf("mkfs put root: %s", err)
	}

	// Entry for /.
	_, mpath, key := mangle(c, "/")
	fi3 := FileInfo{
		Path:    mpath,
		Name:    "/",
		Seq:     2,  // 2, not 1, because we're going to write password file with #2
		Qid:     1,
		ModTime: time.Now(),
		Size:    0,
		IsDir:   true,
	}
	_, err = datastore.Put(c, key, &fi3)
	if err != nil {
		return nil, fmt.Errorf("mkfs put /: %s", err)
	}

	/*
	 * Would like to use this code but App Engine apparently
	 * does not let Get observe the effect of a Put in the same
	 * transaction.  What planet does that make sense on?
	 * Instead, we have to execute just the datastore writes that this
	 * sequence would.
	 *
	_, err = create(c, pwFile, false)
	if err != nil {
		return nil, fmt.Errorf("mkfs create .password: %s", err)
	}
	_, err = write(c, pwFile, []byte(initPasswd))
	if err != nil {
		return nil, fmt.Errorf("mkfs write .password: %s", err)
	}
	 *
	 */

	{
		name, mname, key := mangle(c, pwFile)

		// Create data object.
		dataKey := int64(2)
		root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
		dkey := datastore.NewKey(c, "FileData", "", dataKey, root)
		_, err := datastore.Put(c, dkey, &FileData{[]byte(initPasswd)})
		if err != nil {
			return nil, err
		}
	
		// Create new directory entry.
		_, elem := path.Split(name)
		fi1 = &FileInfo{
			Path:    mname,
			Name:    elem,
			Qid:     2,
			Seq:     2,
			ModTime: time.Now(),
			Size:    int64(len(initPasswd)),
			IsDir: false,
		}
		if _, err := datastore.Put(c, key, fi1); err != nil {
			return nil, err
		}
	}

	return &fi3, nil
}

func (r *request) write() {
	data, err := ioutil.ReadAll(r.req.Body)
	if err != nil {
		panic(err)
	}

	var fi *FileInfo
	var seq int64
	r.tx(func(c appengine.Context) error {
		var err error
		fi, seq, err = write(r.c, r.name, data)
		return err
	})
	updateCacheTime(r.c, seq)
	r.saveStat(fi)
}

func write(c appengine.Context, name string, data []byte) (*FileInfo, int64, error) {
	name, _, key := mangle(c, name)

	// Check that file exists and is not a directory.
	fi1, err := stat(c, name)
	if err != nil {
		return nil, 0, err
	}
	if fi1.IsDir {
		return nil, 0, fmt.Errorf("cannot write to directory")
	}

	// Fetch and increment root sequence number.
	rfi, err := stat(c, "/")
	if err != nil {
		return nil, 0, err
	}
	rfi.Seq++

	// Write data.
	root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
	dkey := datastore.NewKey(c, "FileData", "", fi1.Qid, root)
	fd := &FileData{data}
	if _, err := datastore.Put(c, dkey, fd); err != nil {
		return nil, 0, err
	}

	// Update directory entry.
	fi1.Seq = rfi.Seq
	fi1.Size = int64(len(data))
	fi1.ModTime = time.Now()
	if _, err := datastore.Put(c, key, fi1); err != nil {
		return nil, 0, err
	}

	// Update sequence numbers all the way to the root.
	if err := updateSeq(c, name, rfi.Seq, 1); err != nil {
		return nil, 0, err
	}

	return fi1, rfi.Seq, nil
}

func updateSeq(c appengine.Context, name string, seq int64, skip int) error {
	p := path.Clean(name)
	for i := 0; ; i++ {
		if i >= skip {
			_, _, key := mangle(c, p)
			var fi FileInfo
			if err := datastore.Get(c, key, &fi); err != nil {
				return err
			}
			fi.Seq = seq
			if _, err := datastore.Put(c, key, &fi); err != nil {
				return err
			}
		}
		if p == "/" {
			break
		}
		p, _ = path.Split(p)
		p = path.Clean(p)
	}
	return nil
}

func (r *request) remove() {
	panic("remove not implemented")
}

func (r *request) create() {
	var fi *FileInfo
	var seq int64
	isDir := r.req.FormValue("dir") == "1"
	r.tx(func(c appengine.Context) error {
		var err error
		fi, seq, err = create(r.c, r.name, isDir, nil)
		return err
	})
	updateCacheTime(r.c, seq)
	r.saveStat(fi)
}

func create(c appengine.Context, name string, isDir bool, data []byte) (*FileInfo, int64, error) {
	name, mname, key := mangle(c, name)

	// File must not exist.
	fi1, err := stat(c, name)
	if err == nil {
		return nil, 0, fmt.Errorf("file already exists")
	}
	if err != datastore.ErrNoSuchEntity {
		return nil, 0, err
	}

	// Parent must exist and be a directory.
	p, _ := path.Split(name)
	fi2, err := stat(c, p)
	if err != nil {
		if err == datastore.ErrNoSuchEntity {
			return nil, 0, fmt.Errorf("parent directory %q does not exist", p)
		}
		return nil, 0, err
	}
	if !fi2.IsDir {
		return nil, 0, fmt.Errorf("parent %q is not a directory", p)
	}

	// Fetch and increment root sequence number.
	rfi, err := stat(c, "/")
	if err != nil {
		return nil, 0, err
	}
	rfi.Seq++

	var dataKey int64
	// Create data object.
	if !isDir {
		dataKey = rfi.Seq
		root := datastore.NewKey(c, "RootKey", "v2:", 0, nil)
		dkey := datastore.NewKey(c, "FileData", "", dataKey, root)
		_, err := datastore.Put(c, dkey, &FileData{data})
		if err != nil {
			return nil, 0, err
		}
	}

	// Create new directory entry.
	_, elem := path.Split(name)
	fi1 = &FileInfo{
		Path:    mname,
		Name:    elem,
		Qid:     rfi.Seq,
		Seq:     rfi.Seq,
		ModTime: time.Now(),
		Size:    int64(len(data)),
		IsDir:   isDir,
	}
	if _, err := datastore.Put(c, key, fi1); err != nil {
		return nil, 0, err
	}

	// Update sequence numbers all the way to root,
	// but skip entry we just wrote.
	if err := updateSeq(c, name, rfi.Seq, 1); err != nil {
		return nil, 0, err
	}

	return fi1, rfi.Seq, nil
}

// Implementation of fs.AppEngine.

func init() {
	fs.Register(ae{})
}

type ae struct{}

func tx(c interface{}, f func(c appengine.Context) error) error {
	return datastore.RunInTransaction(c.(appengine.Context), f, &datastore.TransactionOptions{XG: true})
}

func (ae) NewContext(req *http.Request) interface{} {
	return appengine.NewContext(req)
}

func (ae) User(ctxt interface{}) string {
	c := ctxt.(appengine.Context)
	u := user.Current(c)
	if u == nil {
		return "?"
	}
	return u.String()
}

type cacheKey struct {
	t int64
	name string
}

func (ae) CacheRead(ctxt interface{}, name, path string) (key interface{}, data []byte, found bool) {
	c := ctxt.(appengine.Context)
	t, data, _, err := cacheRead(c, "cache", name, path)
	return &cacheKey{t, name}, data, err == nil
}

func (ae) CacheWrite(ctxt, key interface{}, data []byte) {
	c := ctxt.(appengine.Context)
	k := key.(*cacheKey)
	cacheWrite(c, k.t, "cache", k.name, data)
}

func (ae ae) Read(ctxt interface{}, name string) (data []byte, pfi *proto.FileInfo, err error) {
	c := ctxt.(appengine.Context)
	name = path.Clean("/"+name)
	if chatty {
		c.Infof("AE Read %s", name)
	}
	_, data, pfi, err = cacheRead(c, "data", name, name)
	if err != nil {
		err = fmt.Errorf("Read %q: %v", name, err)
	}
	return
}

func (ae) Write(ctxt interface{}, path string, data []byte) error {
	var seq int64
	err := tx(ctxt, func(c appengine.Context) error {
		_, err := stat(c, path)
		if err != nil {
			_, seq, err = create(c, path, false, data)
		} else {
			_, seq, err = write(c, path, data)
		}
		return err
	})
	if seq != 0 {
		updateCacheTime(ctxt.(appengine.Context), seq)
	}
	if err != nil {
		err = fmt.Errorf("Write %q: %v", path, err)
	}
	return err
}

func (ae) Remove(ctxt interface{}, path string) error {
	return fmt.Errorf("remove not implemented")
}

func (ae) Mkdir(ctxt interface{}, path string) error {
	var seq int64
	err := tx(ctxt, func(c appengine.Context) error {
		var err error
		_, seq, err = create(c, path, true, nil)
		return err
	})
	if seq != 0 {
		updateCacheTime(ctxt.(appengine.Context), seq)
	}
	if err != nil {
		err = fmt.Errorf("Mkdir %q: %v", path, err)
	}
	return err
}

func (ae) Criticalf(ctxt interface{}, format string, args ...interface{}) {
	ctxt.(appengine.Context).Criticalf(format, args...)
}

type readDirCacheEntry struct {
	Dir []proto.FileInfo
	Error string
}

func (ae) ReadDir(ctxt interface{}, name string) (dir []proto.FileInfo, err error) {	
	c := ctxt.(appengine.Context)
	name = path.Clean("/"+name)
	t, data, _, err := cacheRead(c, "dir", name, name)
	if err == nil {
		var e readDirCacheEntry
		if err := json.Unmarshal(data, &e); err == nil {
			if chatty {
				c.Infof("cached ReadDir %q", name)
			}
			if e.Error != "" {
				return nil, errors.New(e.Error)
			}
			return e.Dir, nil
		}
		c.Criticalf("unmarshal cached dir %q: %v", name)
	}
	err = tx(ctxt, func(c appengine.Context) error {
		var err error
		dir, err = readdirRaw(c, name)
		return err
	})
	var e readDirCacheEntry
	e.Dir = dir
	if err != nil {
		err = fmt.Errorf("ReadDir %q: %v", name, err)
		e.Error = err.Error()
	}
	if data, err := json.Marshal(&e); err != nil {
		c.Criticalf("json marshal cached dir: %v", err)
	} else {
		c.Criticalf("caching dir %q@%d %d bytes", name, t, len(data))
		cacheWrite(c, t, "dir", name, data)
	}
	return
}

// Caching of file system data.
//
// The cache stores entries under keys of the form time,space,name,
// where time is the time at which the entry is valid for, space is a name
// space identifier, and name is an arbitrary name.
//
// A key of the form t,mtime,path maps to an integer value giving the
// modification time of the named path at root time t.
// The special key 0,mtime,/ is an integer giving the current time at the root.
//
// A key of the form t,data,path maps to the content of path at time t.
//
// Thus, a read from path should first obtain the root time,
// then obtain the modification time for the path at that root time
// then obtain the data for that path.
//	t1 = get(0,mtime,/)
//	t2 = get(t1,mtime,path)
//	data = get(t2,data,path)
//
// The API allows clients to cache their own data too, with expiry tied to
// the modification time of a particular path (file or directory).  To look
// up one of those, we use:
//	t1 = get(0,mtime,/)
//	t2 = get(t1,mtime,path)
//	data = get(t2,clientdata,name)
//
// To store data in the cache, the t1, t2 should be determined before reading
// from datastore.  Then the data should be saved under t2.  This ensures
// that if a datastore update happens after the read but before the cache write,
// we'll be writing to an entry that will no longer be used (t2).

const rootMemcacheKey = "0,mtime,/"

func updateCacheTime(c appengine.Context, seq int64) {
	const key = rootMemcacheKey
	bseq := []byte(strconv.FormatInt(seq, 10))
	for tries := 0; tries < 10; tries++ {
		item, err := memcache.Get(c, key)
		if err != nil {
			c.Infof("memcache.Get %q: %v", key, err)
			err = memcache.Add(c, &memcache.Item{Key: key, Value: bseq})
			if err == nil {
				c.Infof("memcache.Add %q %q ok", key, bseq)
				return
			}
			c.Infof("memcache.Add %q %q: %v", key, bseq, err)
		}
		v, err := strconv.ParseInt(string(item.Value), 10, 64)
		if err != nil {
			c.Criticalf("memcache.Get %q = %q (%v)", key, item.Value, err)
			return
		}
		if v >= seq {
			return
		}
		item.Value = bseq
		err = memcache.CompareAndSwap(c, item)
		if err == nil {
			c.Infof("memcache.CAS %q %d->%d ok", key, v, seq)
			return
		}
		c.Infof("memcache.CAS %q %d->%d: %v", key, v, seq, err)
	}
	c.Criticalf("repeatedly failed to update root key")
}

func cacheTime(c appengine.Context) (t int64, err error) {
	const key = rootMemcacheKey
	item, err := memcache.Get(c, key)
	if err == nil {
		v, err := strconv.ParseInt(string(item.Value), 10, 64)
		if err == nil {
			if chatty {
				c.Infof("cacheTime %q = %v", key, v)
			}
			return v, nil
		}
		c.Criticalf("memcache.Get %q = %q (%v) - deleting", key, item.Value, err)
		memcache.Delete(c, key)
	}
	fi, err := stat(c, "/")
	if err != nil {
		c.Criticalf("stat /: %v", err)
		return 0, err
	}
	updateCacheTime(c, fi.Seq)
	return fi.Seq, nil
}

func cachePathTime(c appengine.Context, path string) (t int64, err error) {
	t, err = cacheTime(c)
	if err != nil {
		return 0, err
	}
	
	key := fmt.Sprintf("%d,mtime,%s", t, path)
	item, err := memcache.Get(c, key)
	if err == nil {
		v, err := strconv.ParseInt(string(item.Value), 10, 64)
		if err == nil {
			if chatty {
				c.Infof("cachePathTime %q = %v", key, v)
			}
			return v, nil
		}
		c.Criticalf("memcache.Get %q = %q (%v) - deleting", key, item.Value, err)
		memcache.Delete(c, key)
	}

	var seq int64
	if fi, err := stat(c, path); err == nil {
		seq = fi.Seq
	}

	c.Infof("cachePathTime save %q = %v", key, seq)
	item = &memcache.Item{Key: key, Value: []byte(strconv.FormatInt(seq, 10))}
	if err := memcache.Set(c, item); err != nil {
		c.Criticalf("memcache.Set %q %q: %v", key, item.Value, err)
	}
	return seq, nil
}

type statCacheEntry struct {
	FileInfo *proto.FileInfo
	Error string
}

func cacheRead(c appengine.Context, kind, name, path string) (mtime int64, data []byte, pfi *proto.FileInfo, err error) {
	for tries := 0; tries < 10; tries++ {
		t, err := cachePathTime(c, path)
		if err != nil {
			return 0, nil, nil, err
		}
	
		key := fmt.Sprintf("%d,%s,%s", t, kind, name)
		item, err := memcache.Get(c, key)
		var data []byte
		if item != nil {
			data = item.Value
		}
		if err != nil {
			c.Infof("memcache miss %q %v", key, err)
		} else if chatty {
			c.Infof("memcache hit %q (%d bytes)", key, len(data))
		}
		if kind != "data" {
			// Not a file; whatever memcache says is all we have.
			return t, data, nil, err
		}

		// Load stat from cache (includes negative entry).
		statkey := fmt.Sprintf("%d,stat,%s", t, name)
		var st statCacheEntry
		_, err = memcache.JSON.Get(c, statkey, &st)
		if err == nil {
			if st.Error != "" {
				if chatty {
					c.Infof("memcache hit stat error %q %q", statkey, st.Error)
				}
				err = errors.New(st.Error)
			} else {
				if chatty {
					c.Infof("memcache hit stat %q", statkey)
				}
			}
			if err != nil || data != nil {
				return t, data, st.FileInfo, err
			}
		}
		
		// Need stat, or maybe stat+data.
		var fi *FileInfo
		if data != nil {
			c.Infof("stat %q", name)
			fi, err = stat(c, name)
			if err == nil && fi.Seq != t {
				c.Criticalf("loaded %s but found stat %d", key, fi.Seq)
				continue
			}
		} else {
			c.Infof("read %q", name)
			fi, data, err = read(c, name)
			if err == nil && fi.Seq != t {
				c.Infof("loaded %s but found read %d", key, fi.Seq)
				t = fi.Seq
				key = fmt.Sprintf("%d,data,%s", t, name)
				statkey = fmt.Sprintf("%d,stat,%s", t, name)
			}

			// Save data to memcache.
			if err == nil {
				if true || chatty {
					c.Infof("save data in memcache %q", key)
				}
				item := &memcache.Item{Key: key, Value: data}
				if err := memcache.Set(c, item); err != nil {
					c.Criticalf("failed to cache %s: %v", key, err)
				}
			}
		}
		
		// Cache stat, including error.
		st = statCacheEntry{}
		if fi != nil {
			st.FileInfo = &proto.FileInfo{
				Name:    fi.Name,
				ModTime: fi.ModTime,
				Size:    fi.Size,
				IsDir:   fi.IsDir,
			}
		}
		if err != nil {
			st.Error = err.Error()
			// If this is a deadline exceeded, do not cache.
			if strings.Contains(st.Error, "Canceled") || strings.Contains(st.Error, "Deadline") {
				return t, data, st.FileInfo, err
			}
		}
		if chatty {
			c.Infof("save stat in memcache %q", statkey)
		}
		if err := memcache.JSON.Set(c, &memcache.Item{Key: statkey, Object: &st}); err != nil {
			c.Criticalf("failed to cache %s: %v", statkey, err)
		}

		// Done!
		return t, data, st.FileInfo, err
	}
	
	c.Criticalf("failed repeatedly in cacheRead")
	return 0, nil, nil, errors.New("cacheRead loop failed")
}

func cacheWrite(c appengine.Context, t int64, kind, name string, data []byte) error {
	mkey := fmt.Sprintf("%d,%s,%s", t, kind, name)
	if true || chatty {
		c.Infof("cacheWrite %s %d bytes", mkey, len(data))
	}
	err := memcache.Set(c, &memcache.Item{Key: mkey, Value: data})
	if err != nil {
		c.Criticalf("cacheWrite memcache.Set %q: %v", mkey, err)
	}
	return err
}
