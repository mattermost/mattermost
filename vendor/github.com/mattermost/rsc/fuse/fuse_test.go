// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fuse

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"runtime"
	"syscall"
	"testing"
	"time"
)

var fuseRun = flag.String("fuserun", "", "which fuse test to run. runs all if empty.")

// umount tries its best to unmount dir.
func umount(dir string) {
	err := exec.Command("umount", dir).Run()
	if err != nil && runtime.GOOS == "linux" {
		exec.Command("/bin/fusermount", "-u", dir).Run()
	}
}

func TestFuse(t *testing.T) {
	Debugf = log.Printf
	dir, err := ioutil.TempDir("", "fusetest")
	if err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(dir, 0777)

	c, err := Mount(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer umount(dir)

	go func() {
		err := c.Serve(testFS{})
		if err != nil {
			fmt.Printf("SERVE ERROR: %v\n", err)
		}
	}()

	waitForMount(t, dir)

	for _, tt := range fuseTests {
		if *fuseRun == "" || *fuseRun == tt.name {
			t.Logf("running %T", tt.node)
			tt.node.test(dir+"/"+tt.name, t)
		}
	}
}

func waitForMount(t *testing.T, dir string) {
	// Filename to wait for in dir:
	probeEntry := *fuseRun
	if probeEntry == "" {
		probeEntry = fuseTests[0].name
	}
	for tries := 0; tries < 100; tries++ {
		_, err := os.Stat(dir + "/" + probeEntry)
		if err == nil {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("mount did not work")
}

var fuseTests = []struct {
	name string
	node interface {
		Node
		test(string, *testing.T)
	}
}{
	{"readAll", readAll{}},
	{"readAll1", &readAll1{}},
	{"write", &write{}},
	{"writeAll", &writeAll{}},
	{"writeAll2", &writeAll2{}},
	{"release", &release{}},
	{"mkdir1", &mkdir1{}},
	{"create1", &create1{}},
	{"create2", &create2{}},
	{"symlink1", &symlink1{}},
	{"link1", &link1{}},
	{"rename1", &rename1{}},
	{"mknod1", &mknod1{}},
}

// TO TEST:
//	Statfs
//	Lookup(*LookupRequest, *LookupResponse)
//	Getattr(*GetattrRequest, *GetattrResponse)
//	Attr with explicit inode
//	Setattr(*SetattrRequest, *SetattrResponse)
//	Access(*AccessRequest)
//	Open(*OpenRequest, *OpenResponse)
//	Getxattr, Setxattr, Listxattr, Removexattr
//	Write(*WriteRequest, *WriteResponse)
//	Flush(*FlushRequest, *FlushResponse)

// Test Read calling ReadAll.

type readAll struct{ file }

const hi = "hello, world"

func (readAll) ReadAll(intr Intr) ([]byte, Error) {
	return []byte(hi), nil
}

func (readAll) test(path string, t *testing.T) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		t.Errorf("readAll: %v", err)
		return
	}
	if string(data) != hi {
		t.Errorf("readAll = %q, want %q", data, hi)
	}
}

// Test Read.

type readAll1 struct{ file }

func (readAll1) Read(req *ReadRequest, resp *ReadResponse, intr Intr) Error {
	HandleRead(req, resp, []byte(hi))
	return nil
}

func (readAll1) test(path string, t *testing.T) {
	readAll{}.test(path, t)
}

// Test Write calling basic Write, with an fsync thrown in too.

type write struct {
	file
	data     []byte
	gotfsync bool
}

func (w *write) Write(req *WriteRequest, resp *WriteResponse, intr Intr) Error {
	w.data = append(w.data, req.Data...)
	resp.Size = len(req.Data)
	return nil
}

func (w *write) Fsync(r *FsyncRequest, intr Intr) Error {
	w.gotfsync = true
	return nil
}

func (w *write) test(path string, t *testing.T) {
	log.Printf("pre-write Create")
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	log.Printf("pre-write Write")
	n, err := f.Write([]byte(hi))
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if n != len(hi) {
		t.Fatalf("short write; n=%d; hi=%d", n, len(hi))
	}

	err = syscall.Fsync(int(f.Fd()))
	if err != nil {
		t.Fatalf("Fsync = %v", err)
	}
	if !w.gotfsync {
		t.Errorf("never received expected fsync call")
	}

	log.Printf("pre-write Close")
	err = f.Close()
	if err != nil {
		t.Fatalf("Close: %v", err)
	}
	log.Printf("post-write Close")
	if string(w.data) != hi {
		t.Errorf("writeAll = %q, want %q", w.data, hi)
	}
}

// Test Write calling WriteAll.

type writeAll struct {
	file
	data     []byte
	gotfsync bool
}

func (w *writeAll) Fsync(r *FsyncRequest, intr Intr) Error {
	w.gotfsync = true
	return nil
}

func (w *writeAll) WriteAll(data []byte, intr Intr) Error {
	w.data = data
	return nil
}

func (w *writeAll) test(path string, t *testing.T) {
	err := ioutil.WriteFile(path, []byte(hi), 0666)
	if err != nil {
		t.Fatalf("WriteFile: %v", err)
		return
	}
	if string(w.data) != hi {
		t.Errorf("writeAll = %q, want %q", w.data, hi)
	}
}

// Test Write calling Setattr+Write+Flush.

type writeAll2 struct {
	file
	data    []byte
	setattr bool
	flush   bool
}

func (w *writeAll2) Setattr(req *SetattrRequest, resp *SetattrResponse, intr Intr) Error {
	w.setattr = true
	return nil
}

func (w *writeAll2) Flush(req *FlushRequest, intr Intr) Error {
	w.flush = true
	return nil
}

func (w *writeAll2) Write(req *WriteRequest, resp *WriteResponse, intr Intr) Error {
	w.data = append(w.data, req.Data...)
	resp.Size = len(req.Data)
	return nil
}

func (w *writeAll2) test(path string, t *testing.T) {
	err := ioutil.WriteFile(path, []byte(hi), 0666)
	if err != nil {
		t.Errorf("WriteFile: %v", err)
		return
	}
	if !w.setattr || string(w.data) != hi || !w.flush {
		t.Errorf("writeAll = %v, %q, %v, want %v, %q, %v", w.setattr, string(w.data), w.flush, true, hi, true)
	}
}

// Test Mkdir.

type mkdir1 struct {
	dir
	name string
}

func (f *mkdir1) Mkdir(req *MkdirRequest, intr Intr) (Node, Error) {
	f.name = req.Name
	return &mkdir1{}, nil
}

func (f *mkdir1) test(path string, t *testing.T) {
	f.name = ""
	err := os.Mkdir(path+"/foo", 0777)
	if err != nil {
		t.Error(err)
		return
	}
	if f.name != "foo" {
		t.Error(err)
		return
	}
}

// Test Create (and fsync)

type create1 struct {
	dir
	name string
	f    *writeAll
}

func (f *create1) Create(req *CreateRequest, resp *CreateResponse, intr Intr) (Node, Handle, Error) {
	f.name = req.Name
	f.f = &writeAll{}
	return f.f, f.f, nil
}

func (f *create1) test(path string, t *testing.T) {
	f.name = ""
	ff, err := os.Create(path + "/foo")
	if err != nil {
		t.Errorf("create1 WriteFile: %v", err)
		return
	}

	err = syscall.Fsync(int(ff.Fd()))
	if err != nil {
		t.Fatalf("Fsync = %v", err)
	}

	if !f.f.gotfsync {
		t.Errorf("never received expected fsync call")
	}

	ff.Close()
	if f.name != "foo" {
		t.Errorf("create1 name=%q want foo", f.name)
	}
}

// Test Create + WriteAll + Remove

type create2 struct {
	dir
	name      string
	f         *writeAll
	fooExists bool
}

func (f *create2) Create(req *CreateRequest, resp *CreateResponse, intr Intr) (Node, Handle, Error) {
	f.name = req.Name
	f.f = &writeAll{}
	return f.f, f.f, nil
}

func (f *create2) Lookup(name string, intr Intr) (Node, Error) {
	if f.fooExists && name == "foo" {
		return file{}, nil
	}
	return nil, ENOENT
}

func (f *create2) Remove(r *RemoveRequest, intr Intr) Error {
	if f.fooExists && r.Name == "foo" && !r.Dir {
		f.fooExists = false
		return nil
	}
	return ENOENT
}

func (f *create2) test(path string, t *testing.T) {
	f.name = ""
	err := ioutil.WriteFile(path+"/foo", []byte(hi), 0666)
	if err != nil {
		t.Fatalf("create2 WriteFile: %v", err)
	}
	if string(f.f.data) != hi {
		t.Fatalf("create2 writeAll = %q, want %q", f.f.data, hi)
	}

	f.fooExists = true
	log.Printf("pre-Remove")
	err = os.Remove(path + "/foo")
	if err != nil {
		t.Fatalf("Remove: %v", err)
	}
	err = os.Remove(path + "/foo")
	if err == nil {
		t.Fatalf("second Remove = nil; want some error")
	}
}

// Test symlink + readlink

type symlink1 struct {
	dir
	newName, target string
}

func (f *symlink1) Symlink(req *SymlinkRequest, intr Intr) (Node, Error) {
	f.newName = req.NewName
	f.target = req.Target
	return symlink{target: req.Target}, nil
}

func (f *symlink1) test(path string, t *testing.T) {
	const target = "/some-target"

	err := os.Symlink(target, path+"/symlink.file")
	if err != nil {
		t.Errorf("os.Symlink: %v", err)
		return
	}

	if f.newName != "symlink.file" {
		t.Errorf("symlink newName = %q; want %q", f.newName, "symlink.file")
	}
	if f.target != target {
		t.Errorf("symlink target = %q; want %q", f.target, target)
	}

	gotName, err := os.Readlink(path + "/symlink.file")
	if err != nil {
		t.Errorf("os.Readlink: %v", err)
		return
	}
	if gotName != target {
		t.Errorf("os.Readlink = %q; want %q", gotName, target)
	}
}

// Test link

type link1 struct {
	dir
	newName string
}

func (f *link1) Lookup(name string, intr Intr) (Node, Error) {
	if name == "old" {
		return file{}, nil
	}
	return nil, ENOENT
}

func (f *link1) Link(r *LinkRequest, old Node, intr Intr) (Node, Error) {
	f.newName = r.NewName
	return file{}, nil
}

func (f *link1) test(path string, t *testing.T) {
	err := os.Link(path+"/old", path+"/new")
	if err != nil {
		t.Fatalf("Link: %v", err)
	}
	if f.newName != "new" {
		t.Fatalf("saw Link for newName %q; want %q", f.newName, "new")
	}
}

// Test Rename

type rename1 struct {
	dir
	renames int
}

func (f *rename1) Lookup(name string, intr Intr) (Node, Error) {
	if name == "old" {
		return file{}, nil
	}
	return nil, ENOENT
}

func (f *rename1) Rename(r *RenameRequest, newDir Node, intr Intr) Error {
	if r.OldName == "old" && r.NewName == "new" && newDir == f {
		f.renames++
		return nil
	}
	return EIO
}

func (f *rename1) test(path string, t *testing.T) {
	err := os.Rename(path+"/old", path+"/new")
	if err != nil {
		t.Fatalf("Rename: %v", err)
	}
	if f.renames != 1 {
		t.Fatalf("expected rename didn't happen")
	}
	err = os.Rename(path+"/old2", path+"/new2")
	if err == nil {
		t.Fatal("expected error on second Rename; got nil")
	}
}

// Test Release.

type release struct {
	file
	did bool
}

func (r *release) Release(*ReleaseRequest, Intr) Error {
	r.did = true
	return nil
}

func (r *release) test(path string, t *testing.T) {
	r.did = false
	f, err := os.Open(path)
	if err != nil {
		t.Error(err)
		return
	}
	f.Close()
	time.Sleep(1 * time.Second)
	if !r.did {
		t.Error("Close did not Release")
	}
}

// Test mknod

type mknod1 struct {
	dir
	gotr *MknodRequest
}

func (f *mknod1) Mknod(r *MknodRequest, intr Intr) (Node, Error) {
	f.gotr = r
	return fifo{}, nil
}

func (f *mknod1) test(path string, t *testing.T) {
	if os.Getuid() != 0 {
		t.Logf("skipping unless root")
		return
	}
	defer syscall.Umask(syscall.Umask(0))
	err := syscall.Mknod(path+"/node", syscall.S_IFIFO|0666, 123)
	if err != nil {
		t.Fatalf("Mknod: %v", err)
	}
	if f.gotr == nil {
		t.Fatalf("no recorded MknodRequest")
	}
	if g, e := f.gotr.Name, "node"; g != e {
		t.Errorf("got Name = %q; want %q", g, e)
	}
	if g, e := f.gotr.Rdev, uint32(123); g != e {
		if runtime.GOOS == "linux" {
			// Linux fuse doesn't echo back the rdev if the node
			// isn't a device (we're using a FIFO here, as that
			// bit is portable.)
		} else {
			t.Errorf("got Rdev = %v; want %v", g, e)
		}
	}
	if g, e := f.gotr.Mode, os.FileMode(os.ModeNamedPipe|0666); g != e {
		t.Errorf("got Mode = %v; want %v", g, e)
	}
	t.Logf("Got request: %#v", f.gotr)
}

type file struct{}
type dir struct{}
type fifo struct{}
type symlink struct {
	target string
}

func (f file) Attr() Attr    { return Attr{Mode: 0666} }
func (f dir) Attr() Attr     { return Attr{Mode: os.ModeDir | 0777} }
func (f fifo) Attr() Attr    { return Attr{Mode: os.ModeNamedPipe | 0666} }
func (f symlink) Attr() Attr { return Attr{Mode: os.ModeSymlink | 0666} }

func (f symlink) Readlink(*ReadlinkRequest, Intr) (string, Error) {
	return f.target, nil
}

type testFS struct{}

func (testFS) Root() (Node, Error) {
	return testFS{}, nil
}

func (testFS) Attr() Attr {
	return Attr{Mode: os.ModeDir | 0555}
}

func (testFS) Lookup(name string, intr Intr) (Node, Error) {
	for _, tt := range fuseTests {
		if tt.name == name {
			return tt.node, nil
		}
	}
	return nil, ENOENT
}

func (testFS) ReadDir(intr Intr) ([]Dirent, Error) {
	var dirs []Dirent
	for _, tt := range fuseTests {
		if *fuseRun == "" || *fuseRun == tt.name {
			log.Printf("Readdir; adding %q", tt.name)
			dirs = append(dirs, Dirent{Name: tt.name})
		}
	}
	return dirs, nil
}
