// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package arq implements read-only access to Arq backups stored on S3.
// Arq is a Mac backup tool (http://www.haystacksoftware.com/arq/)
// but the package can read the backups regardless of operating system.
package arq

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/mattermost/rsc/plist"
	"launchpad.net/goamz/aws"
	"launchpad.net/goamz/s3"
)

// A Conn represents a connection to an S3 server holding Arq backups.
type Conn struct {
	b        *s3.Bucket
	cache    string
	altCache string
}

// cachedir returns the canonical directory in which to cache data.
func cachedir() string {
	if runtime.GOOS == "darwin" {
		return filepath.Join(os.Getenv("HOME"), "Library/Caches/arq-cache")
	}
	return filepath.Join(os.Getenv("HOME"), ".cache/arq-cache")
}

// Dial establishes a connection to an S3 server holding Arq backups.
func Dial(auth aws.Auth) (*Conn, error) {
	buck := fmt.Sprintf("%s-com-haystacksoftware-arq", strings.ToLower(auth.AccessKey))
	b := s3.New(auth, aws.USEast).Bucket(buck)
	c := &Conn{
		b:     b,
		cache: filepath.Join(cachedir(), buck),
	}
	if runtime.GOOS == "darwin" {
		c.altCache = filepath.Join(os.Getenv("HOME"), "Library/Arq/Cache.noindex/"+buck)
	}

	// Check that the bucket works by listing computers (relatively cheap).
	if _, err := c.list("", "/", 10); err != nil {
		return nil, err
	}

	// Create S3 lookaside cache directory.

	return c, nil
}

func (c *Conn) list(prefix, delim string, max int) (*s3.ListResp, error) {
	resp, err := c.b.List(prefix, delim, "", max)
	if err != nil {
		return nil, err
	}
	ret := resp
	for max == 0 && resp.IsTruncated {
		last := resp.Contents[len(resp.Contents)-1].Key
		resp, err = c.b.List(prefix, delim, last, max)
		if err != nil {
			return ret, err
		}
		ret.Contents = append(ret.Contents, resp.Contents...)
		ret.CommonPrefixes = append(ret.CommonPrefixes, resp.CommonPrefixes...)
	}
	return ret, nil
}

func (c *Conn) altCachePath(name string) string {
	if c.altCache == "" || !strings.Contains(name, "/packsets/") {
		return ""
	}
	i := strings.Index(name, "-trees/")
	if i < 0 {
		i = strings.Index(name, "-blobs/")
		if i < 0 {
			return ""
		}
	}
	i += len("-trees/") + 2
	if i >= len(name) {
		return ""
	}
	return filepath.Join(c.altCache, name[:i]+"/"+name[i:])
}

func (c *Conn) cget(name string) (data []byte, err error) {
	cache := filepath.Join(c.cache, name)
	f, err := os.Open(cache)
	if err == nil {
		defer f.Close()
		return ioutil.ReadAll(f)
	}
	if altCache := c.altCachePath(name); altCache != "" {
		f, err := os.Open(altCache)
		if err == nil {
			defer f.Close()
			return ioutil.ReadAll(f)
		}
	}

	data, err = c.bget(name)
	if err != nil {
		return nil, err
	}

	dir, _ := filepath.Split(cache)
	os.MkdirAll(dir, 0700)
	ioutil.WriteFile(cache, data, 0600)
	return data, nil
}

func (c *Conn) bget(name string) (data []byte, err error) {
	for i := 0; ; {
		data, err = c.b.Get(name)
		if err == nil {
			break
		}
		if i++; i >= 5 {
			return nil, err
		}
		log.Print(err)
	}
	return data, nil
}

func (c *Conn) DeleteCache() {
	os.RemoveAll(c.cache)
}

// Computers returns a list of the computers with backups available on the S3 server.
func (c *Conn) Computers() ([]*Computer, error) {
	// Each backup is a top-level directory with a computerinfo file in it.
	list, err := c.list("", "/", 0)
	if err != nil {
		return nil, err
	}
	var out []*Computer
	for _, p := range list.CommonPrefixes {
		data, err := c.bget(p + "computerinfo")
		if err != nil {
			continue
		}
		var info computerInfo
		if err := plist.Unmarshal(data, &info); err != nil {
			return nil, err
		}

		comp := &Computer{
			Name:  info.ComputerName,
			User:  info.UserName,
			UUID:  p[:len(p)-1],
			conn:  c,
			index: map[score]ientry{},
		}

		salt, err := c.cget(p + "salt")
		if err != nil {
			return nil, err
		}
		comp.crypto.salt = salt

		out = append(out, comp)
	}
	return out, nil
}

// A Computer represents a computer with backups (Folders).
type Computer struct {
	Name   string // name of computer
	User   string // name of user
	UUID   string
	conn   *Conn
	crypto cryptoState
	index  map[score]ientry
}

// Folders returns a list of the folders that have been backed up on the computer.
func (c *Computer) Folders() ([]*Folder, error) {
	// Each folder is a file under computer/buckets/.
	list, err := c.conn.list(c.UUID+"/buckets/", "", 0)
	if err != nil {
		return nil, err
	}
	var out []*Folder
	for _, obj := range list.Contents {
		data, err := c.conn.bget(obj.Key)
		if err != nil {
			return nil, err
		}
		var info folderInfo
		if err := plist.Unmarshal(data, &info); err != nil {
			return nil, err
		}
		out = append(out, &Folder{
			Path: info.LocalPath,
			uuid: info.BucketUUID,
			comp: c,
			conn: c.conn,
		})
	}
	return out, nil
}

// Unlock records the password to use when decrypting
// backups from this computer.  It must be called before calling Trees
// in any folder obtained for this computer.
func (c *Computer) Unlock(pw string) {
	c.crypto.unlock(pw)
}

func (c *Computer) scget(sc score) ([]byte, error) {
	if c.crypto.c == nil {
		return nil, fmt.Errorf("computer not yet unlocked")
	}

	var data []byte
	var err error
	ie, ok := c.index[sc]
	if ok {
		data, err = c.conn.cget(ie.File)
		if err != nil {
			return nil, err
		}

		//fmt.Printf("offset size %d %d\n", ie.Offset, ie.Size)
		if len(data) < int(ie.Offset+ie.Size) {
			return nil, fmt.Errorf("short pack block")
		}

		data = data[ie.Offset:]
		if ie.Size < 1+8+1+8+8 {
			return nil, fmt.Errorf("short pack block")
		}

		bo := binary.BigEndian

		if data[0] != 1 {
			return nil, fmt.Errorf("missing mime type")
		}
		n := bo.Uint64(data[1:])
		if 1+8+n > uint64(len(data)) {
			return nil, fmt.Errorf("malformed mime type")
		}
		mimeType := data[1+8 : 1+8+n]
		data = data[1+8+n:]

		n = bo.Uint64(data[1:])
		if 1+8+n > uint64(len(data)) {
			return nil, fmt.Errorf("malformed name")
		}
		name := data[1+8 : 1+8+n]
		data = data[1+8+n:]

		_, _ = mimeType, name
		//	fmt.Printf("%s %s\n", mimeType, name)

		n = bo.Uint64(data[0:])
		if int64(n) != ie.Size {
			return nil, fmt.Errorf("unexpected data length %d %d", n, ie.Size)
		}
		if 8+n > uint64(len(data)) {
			return nil, fmt.Errorf("short data %d %d", 8+n, len(data))
		}

		data = data[8 : 8+n]
	} else {
		data, err = c.conn.cget(c.UUID + "/objects/" + sc.String())
		if err != nil {
			log.Fatal(err)
		}
	}

	data = c.crypto.decrypt(data)
	return data, nil
}

// A Folder represents a backed-up tree on a computer.
type Folder struct {
	Path string // root of tree of last backup
	uuid string
	comp *Computer
	conn *Conn
}

// Load loads xxx
func (f *Folder) Load() error {
	if err := f.comp.loadPack(f.uuid, "-trees"); err != nil {
		return err
	}
	if err := f.comp.loadPack(f.uuid, "-blobs"); err != nil {
		return err
	}
	return nil
}

func (c *Computer) loadPack(fold, suf string) error {
	list, err := c.conn.list(c.UUID+"/packsets/"+fold+suf+"/", "", 0)
	if err != nil {
		return err
	}

	for _, obj := range list.Contents {
		if !strings.HasSuffix(obj.Key, ".index") {
			continue
		}
		data, err := c.conn.cget(obj.Key)
		if err != nil {
			return err
		}
		//	fmt.Printf("pack %s\n", obj.Key)
		c.saveIndex(obj.Key[:len(obj.Key)-len(".index")]+".pack", data)
	}
	return nil
}

func (c *Computer) saveIndex(file string, data []byte) error {
	const (
		headerSize  = 4 + 4 + 4*256
		entrySize   = 8 + 8 + 20 + 4
		trailerSize = 20
	)
	bo := binary.BigEndian
	if len(data) < headerSize+trailerSize {
		return fmt.Errorf("short index")
	}
	i := len(data) - trailerSize
	sum1 := sha(data[:i])
	sum2 := binaryScore(data[i:])
	if !sum1.Equal(sum2) {
		return fmt.Errorf("invalid sha index")
	}

	obj := data[headerSize : len(data)-trailerSize]
	n := len(obj) / entrySize
	if n*entrySize != len(obj) {
		return fmt.Errorf("misaligned index %d %d", n*entrySize, len(obj))
	}
	nn := bo.Uint32(data[headerSize-4:])
	if int(nn) != n {
		return fmt.Errorf("inconsistent index %d %d\n", nn, n)
	}

	for i := 0; i < n; i++ {
		e := obj[i*entrySize:]
		var ie ientry
		ie.File = file
		ie.Offset = int64(bo.Uint64(e[0:]))
		ie.Size = int64(bo.Uint64(e[8:]))
		ie.Score = binaryScore(e[16:])
		c.index[ie.Score] = ie
	}
	return nil
}

// Trees returns a list of the individual backup snapshots for the folder.
// Note that different trees from the same Folder might have different Paths
// if the folder was "relocated" using the Arq interface.
func (f *Folder) Trees() ([]*Tree, error) {
	data, err := f.conn.bget(f.comp.UUID + "/bucketdata/" + f.uuid + "/refs/heads/master")
	if err != nil {
		return nil, err
	}
	sc := hexScore(string(data))
	if err != nil {
		return nil, err
	}

	var out []*Tree
	for {
		data, err = f.comp.scget(sc)
		if err != nil {
			return nil, err
		}

		var com commit
		if err := unpack(data, &com); err != nil {
			return nil, err
		}

		var info folderInfo
		if err := plist.Unmarshal(com.BucketXML, &info); err != nil {
			return nil, err
		}

		t := &Tree{
			Time:  com.CreateTime,
			Path:  info.LocalPath,
			Score: com.Tree.Score,

			commit: com,
			comp:   f.comp,
			folder: f,
			info:   info,
		}
		out = append(out, t)

		if len(com.ParentCommits) == 0 {
			break
		}

		sc = com.ParentCommits[0].Score
	}

	for i, n := 0, len(out)-1; i < n-i; i++ {
		out[i], out[n-i] = out[n-i], out[i]
	}
	return out, nil
}

func (f *Folder) Trees2() ([]*Tree, error) {
	list, err := f.conn.list(f.comp.UUID+"/bucketdata/"+f.uuid+"/refs/logs/master/", "", 0)
	if err != nil {
		return nil, err
	}

	var out []*Tree
	for _, obj := range list.Contents {
		data, err := f.conn.cget(obj.Key)
		if err != nil {
			return nil, err
		}
		var l reflog
		if err := plist.Unmarshal(data, &l); err != nil {
			return nil, err
		}

		sc := hexScore(l.NewHeadSHA1)
		if err != nil {
			return nil, err
		}

		data, err = f.comp.scget(sc)
		if err != nil {
			return nil, err
		}

		var com commit
		if err := unpack(data, &com); err != nil {
			return nil, err
		}

		var info folderInfo
		if err := plist.Unmarshal(com.BucketXML, &info); err != nil {
			return nil, err
		}

		t := &Tree{
			Time:  com.CreateTime,
			Path:  info.LocalPath,
			Score: com.Tree.Score,

			commit: com,
			comp:   f.comp,
			folder: f,
			info:   info,
		}
		out = append(out, t)
	}
	return out, nil
}

// A Tree represents a single backed-up file tree snapshot.
type Tree struct {
	Time  time.Time // time back-up completed
	Path  string    // root of backed-up tree
	Score [20]byte

	comp   *Computer
	folder *Folder
	commit commit
	info   folderInfo

	raw     tree
	haveRaw bool
}

// Root returns the File for the tree's root directory.
func (t *Tree) Root() (*File, error) {
	if !t.haveRaw {
		data, err := t.comp.scget(t.Score)
		if err != nil {
			return nil, err
		}
		if err := unpack(data, &t.raw); err != nil {
			return nil, err
		}
		t.haveRaw = true
	}

	dir := &File{
		t:   t,
		dir: &t.raw,
		n:   &nameNode{"/", node{IsTree: true}},
	}
	return dir, nil
}

// A File represents a file or directory in a tree.
type File struct {
	t      *Tree
	n      *nameNode
	dir    *tree
	byName map[string]*nameNode
}

func (f *File) loadDir() error {
	if f.dir == nil {
		data, err := f.t.comp.scget(f.n.Node.Blob[0].Score)
		if err != nil {
			return err
		}
		var dir tree
		if err := unpack(data, &dir); err != nil {
			return err
		}
		f.dir = &dir
	}
	return nil
}

func (f *File) Lookup(name string) (*File, error) {
	if !f.n.Node.IsTree {
		return nil, fmt.Errorf("lookup in non-directory")
	}
	if f.byName == nil {
		if err := f.loadDir(); err != nil {
			return nil, err
		}
		f.byName = map[string]*nameNode{}
		for _, n := range f.dir.Nodes {
			f.byName[n.Name] = n
		}
	}
	n := f.byName[name]
	if n == nil {
		return nil, fmt.Errorf("no entry %q", name)
	}
	return &File{t: f.t, n: n}, nil
}

func (f *File) Stat() *Dirent {
	if f.n.Node.IsTree {
		if err := f.loadDir(); err == nil {
			return &Dirent{
				Name:    f.n.Name,
				ModTime: f.dir.Mtime.Time(),
				Mode:    fileMode(f.dir.Mode),
				Size:    0,
			}
		}
	}
	return &Dirent{
		Name:    f.n.Name,
		ModTime: f.n.Node.Mtime.Time(),
		Mode:    fileMode(f.n.Node.Mode),
		Size:    int64(f.n.Node.UncompressedSize),
	}
}

type Dirent struct {
	Name    string
	ModTime time.Time
	Mode    os.FileMode
	Size    int64
}

func (f *File) ReadDir() ([]Dirent, error) {
	if !f.n.Node.IsTree {
		return nil, fmt.Errorf("ReadDir in non-directory")
	}
	if err := f.loadDir(); err != nil {
		return nil, err
	}
	var out []Dirent
	for _, n := range f.dir.Nodes {
		out = append(out, Dirent{
			Name:    n.Name,
			ModTime: n.Node.Mtime.Time(),
			Mode:    fileMode(n.Node.Mode),
		})
	}
	return out, nil
}

func (f *File) Open() (io.ReadCloser, error) {
	return &fileReader{t: f.t, blob: f.n.Node.Blob, n: &f.n.Node}, nil
}

type fileReader struct {
	t     *Tree
	n     *node
	blob  []sscore
	cur   io.Reader
	close []io.Closer
}

func (f *fileReader) Read(b []byte) (int, error) {
	for {
		if f.cur != nil {
			n, err := f.cur.Read(b)
			if n > 0 || err != nil && err != io.EOF {
				return n, err
			}
			for _, cl := range f.close {
				cl.Close()
			}
			f.close = f.close[:0]
			f.cur = nil
		}

		if len(f.blob) == 0 {
			break
		}

		// TODO: Get a direct reader, not a []byte.
		data, err := f.t.comp.scget(f.blob[0].Score)
		if err != nil {
			return 0, err
		}
		rc := ioutil.NopCloser(bytes.NewBuffer(data))

		if f.n.CompressData {
			gz, err := gzip.NewReader(rc)
			if err != nil {
				rc.Close()
				return 0, err
			}
			f.close = append(f.close, gz)
			f.cur = gz
		} else {
			f.cur = rc
		}
		f.close = append(f.close, rc)
		f.blob = f.blob[1:]
	}

	return 0, io.EOF
}

func (f *fileReader) Close() error {
	for _, cl := range f.close {
		cl.Close()
	}
	f.close = f.close[:0]
	f.cur = nil
	return nil
}
