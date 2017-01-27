// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// appmount mounts an appfs file system.
package main

import (
	"bytes"
	"encoding/gob"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"
	"syscall"
	"time"
	"sync"
	"runtime"

	"github.com/mattermost/rsc/appfs/client"
	"github.com/mattermost/rsc/appfs/proto"
	"github.com/mattermost/rsc/fuse"
	"github.com/mattermost/rsc/keychain"
)

var usageMessage = `usage: appmount [-h host] [-u user] [-p password] /mnt

Appmount mounts the appfs file system on the named mount point.

The default host is localhost:8080.
`

// Shared between master and slave.
var z struct {
	Client client.Client
	Debug *bool
	Mtpt string
}

var fc *fuse.Conn
var cl = &z.Client

func init() {
	flag.StringVar(&cl.Host, "h", "localhost:8080", "app serving host")
	flag.StringVar(&cl.User, "u", "", "user name")
	flag.StringVar(&cl.Password, "p", "", "password")
	z.Debug = flag.Bool("debug", false, "")
}

func usage() {
	fmt.Fprint(os.Stderr, usageMessage)
	os.Exit(2)
}

func main() {
	log.SetFlags(0)
	
	if len(os.Args) == 2 && os.Args[1] == "MOUNTSLAVE" {
		mountslave()
		return
	}
		
	flag.Usage = usage
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		usage()
	}
	z.Mtpt = args[0]

	if cl.Password == "" {
		var err error
		cl.User, cl.Password, err = keychain.UserPasswd(cl.Host, "")
		if err != nil {
			fmt.Fprintf(os.Stderr, "unable to obtain user and password: %s\n", err)
			os.Exit(2)
		}
	}

	if _, err := cl.Stat("/"); err != nil {
		log.Fatal(err)
	}
	
	// Run in child so that we can exit once child is running.
	r, w, err := os.Pipe()
	if err != nil {
		log.Fatal(err)
	}
	
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	enc.Encode(&z)
	
	cmd := exec.Command(os.Args[0], "MOUNTSLAVE")
	cmd.Stdin = &buf
	cmd.Stdout = w
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Fatalf("mount process: %v", err)
	}
	w.Close()
	
	ok := make([]byte, 10)
	n, _ := r.Read(ok)
	if n != 2 || string(ok[0:2]) != "OK" {
		os.Exit(1)
	}
	
	fmt.Fprintf(os.Stderr, "mounted on %s\n", z.Mtpt)	
}

func mountslave() {
	stdout, _ := syscall.Dup(1)
	syscall.Dup2(2, 1)

	r := gob.NewDecoder(os.Stdin)
	if err := r.Decode(&z); err != nil {
		log.Fatalf("gob decode: %v", err)
	}

	fc, err := fuse.Mount(z.Mtpt)
	if err != nil {
		log.Fatal(err)
	}
	defer exec.Command("umount", z.Mtpt).Run()

	if *z.Debug {
		fuse.Debugf = log.Printf
	}

	syscall.Write(stdout, []byte("OK"))
	syscall.Close(stdout)
	fc.Serve(FS{})
}

type FS struct{}

func (FS) Root() (fuse.Node, fuse.Error) {
	return file("/")
}

type File struct {
	Name     string
	FileInfo *proto.FileInfo
	Data     []byte
}

type statEntry struct {
	fi *proto.FileInfo
	err error
	t time.Time
}

var statCache struct {
	mu sync.Mutex
	m map[string] statEntry
}

func stat(name string) (*proto.FileInfo, error) {
	if runtime.GOOS == "darwin" && strings.Contains(name, "/._") {
		// Mac resource forks
		return nil, fmt.Errorf("file not found")
	}
	statCache.mu.Lock()
	e, ok := statCache.m[name]
	statCache.mu.Unlock()
	if ok && time.Since(e.t) < 2*time.Minute {
		return e.fi, e.err
	}
	fi, err := cl.Stat(name)
	saveStat(name, fi, err)
	return fi, err	
}

func saveStat(name string, fi *proto.FileInfo, err error) {
	if *z.Debug {
if fi != nil {
	fmt.Fprintf(os.Stderr, "savestat %s %+v\n", name, *fi)
} else {
	fmt.Fprintf(os.Stderr, "savestat %s %v\n", name, err)
}
	}	
	statCache.mu.Lock()
	if statCache.m == nil {
		statCache.m = make(map[string]statEntry)
	}
	statCache.m[name] = statEntry{fi, err, time.Now()}
	statCache.mu.Unlock()
}

func delStat(name string) {
	statCache.mu.Lock()
	if statCache.m != nil {
		delete(statCache.m, name)
	}
	statCache.mu.Unlock()
}

func file(name string) (fuse.Node, fuse.Error) {
	fi, err := stat(name)
	if err != nil {
		if strings.Contains(err.Error(), "no such entity") {
			return nil, fuse.ENOENT
		}
		if *z.Debug {
			log.Printf("stat %s: %v", name, err)
		}
		return nil, fuse.EIO
	}
	return &File{name, fi, nil}, nil
}

func (f *File) Attr() (attr fuse.Attr) {
	fi := f.FileInfo
	attr.Mode = 0666
	if fi.IsDir {
		attr.Mode |= 0111 | os.ModeDir
	}
	attr.Mtime =  fi.ModTime
	attr.Size = uint64(fi.Size)
	return
}

func (f *File) Lookup(name string, intr fuse.Intr) (fuse.Node, fuse.Error) {
	return file(path.Join(f.Name, name))
}

func (f *File) ReadAll(intr fuse.Intr) ([]byte, fuse.Error) {
	data, err := cl.Read(f.Name)
	if err != nil {
		log.Printf("read %s: %v", f.Name, err)
		return nil, fuse.EIO
	}
	return data, nil
}

func (f *File) ReadDir(intr fuse.Intr) ([]fuse.Dirent, fuse.Error) {
	fis, err := cl.ReadDir(f.Name)
	if err != nil {
		log.Printf("read %s: %v", f.Name, err)
		return nil, fuse.EIO
	}
	var dirs []fuse.Dirent
	for _, fi := range fis {
		saveStat(path.Join(f.Name, fi.Name), fi, nil)
		dirs = append(dirs, fuse.Dirent{Name: fi.Name})
	}
	return dirs, nil
}

func (f *File) WriteAll(data []byte, intr fuse.Intr) fuse.Error {
	defer delStat(f.Name)
	if err := cl.Write(f.Name[1:], data); err != nil {
		log.Printf("write %s: %v", f.Name, err)
		return fuse.EIO
	}
	return nil
}

func (f *File) Mkdir(req *fuse.MkdirRequest, intr fuse.Intr) (fuse.Node, fuse.Error) {
	defer delStat(f.Name)
	p := path.Join(f.Name, req.Name)
	if err := cl.Create(p[1:], true); err != nil {
		log.Printf("mkdir %s: %v", p, err)
		return nil, fuse.EIO
	}
	delStat(p)
	return file(p)
}

func (f *File) Create(req *fuse.CreateRequest, resp *fuse.CreateResponse, intr fuse.Intr) (fuse.Node, fuse.Handle, fuse.Error) {
	defer delStat(f.Name)
	p := path.Join(f.Name, req.Name)
	if err := cl.Create(p[1:], false); err != nil {
		log.Printf("create %s: %v", p, err)
		return nil, nil, fuse.EIO
	}
	delStat(p)
	n, err := file(p)
	if err != nil {
		return nil, nil, err
	}
	return n, n, nil
}
