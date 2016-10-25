// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Arqfs implements a file system interface to a collection of Arq backups.

    usage: arqfs [-m mtpt]

Arqfs mounts the Arq backups on the file system directory mtpt,
(default /mnt/arq).  The directory must exist and be writable by
the current user.

Arq

Arq is an Amazon S3-based backup system for OS X and sold by
Haystack Software (http://www.haystacksoftware.com/arq/).
This software reads backups written by Arq.
It is not affiliated with or connected to Haystack Software.

Passwords

Arqfs reads necessary passwords from the OS X keychain.
It expects at least two entries:

The keychain entry for s3.amazonaws.com should list the Amazon S3 access ID
as user name and the S3 secret key as password.

Each backup being accessed must have its own keychain entry for
host arq.swtch.com, listing the backup UUID as user name and the encryption
password as the password.

Arqfs will not prompt for passwords or create these entries itself: they must
be created using the Keychain Access application.

FUSE

Arqfs creates a virtual file system using the FUSE file system layer.
On OS X, it requires OSXFUSE (http://osxfuse.github.com/).

Cache

Reading the Arq backups efficiently requires caching directory tree information
on local disk instead of reading the same data from S3 repeatedly.  Arqfs caches
data downloaded from S3 in $HOME/Library/Caches/arq-cache/.
If an Arq installation is present on the same machine, arqfs will look in
its cache ($HOME/Library/Arq/Cache.noindex) first, but arqfs will not
write to Arq's cache directory.

Bugs

Arqfs only runs on OS X for now, because both FUSE and the keychain access
packages have not been ported to other systems yet.

Both Arqfs and the FUSE package on which it is based have seen only light
use.  There are likely to be bugs.  Mail rsc@swtch.com with reports.

*/
package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"syscall"

	"github.com/mattermost/rsc/arq"
	"github.com/mattermost/rsc/fuse"
	"github.com/mattermost/rsc/keychain"
	"launchpad.net/goamz/aws"
)

var mtpt = flag.String("m", "/mnt/arq", "")

func main() {
	log.SetFlags(0)

	if len(os.Args) == 3 && os.Args[1] == "MOUNTSLAVE" {
		*mtpt = os.Args[2]
		mountslave()
		return
	}
	
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: arqfs [-m /mnt/arq]\n")
		os.Exit(2)
	}
	flag.Parse()
	if len(flag.Args()) != 0 {
		flag.Usage()
	}
	
	// Run in child so that we can exit once child is running.
	r, w, err := os.Pipe()
	if err != nil {
		log.Fatal(err)
	}
	
	cmd := exec.Command(os.Args[0], "MOUNTSLAVE", *mtpt)
	cmd.Stdout = w
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Fatalf("mount process: %v", err)
	}
	w.Close()
	
	buf := make([]byte, 10)
	n, _ := r.Read(buf)
	if n != 2 || string(buf[0:2]) != "OK" {
		os.Exit(1)
	}
	
	fmt.Fprintf(os.Stderr, "mounted on %s\n", *mtpt)	
}

func mountslave() {
	stdout, _ := syscall.Dup(1)
	syscall.Dup2(2, 1)

	access, secret, err := keychain.UserPasswd("s3.amazonaws.com", "")
	if err != nil {
		log.Fatal(err)
	}
	auth := aws.Auth{AccessKey: access, SecretKey: secret}

	conn, err := arq.Dial(auth)
	if err != nil {
		log.Fatal(err)
	}

	comps, err := conn.Computers()
	if err != nil {
		log.Fatal(err)
	}

	fs := &fuse.Tree{}
	for _, c := range comps {
		fmt.Fprintf(os.Stderr, "scanning %s...\n", c.Name)

		// TODO: Better password protocol.
		_, pw, err := keychain.UserPasswd("arq.swtch.com", c.UUID)
		if err != nil {
			log.Fatal(err)
		}
		c.Unlock(pw)

		folders, err := c.Folders()
		if err != nil {
			log.Fatal(err)
		}

		lastDate := ""
		n := 0
		for _, f := range folders {
			if err := f.Load(); err != nil {
				log.Fatal(err)
			}
			trees, err := f.Trees()
			if err != nil {
				log.Fatal(err)
			}
			for _, t := range trees {
				y, m, d := t.Time.Date()
				date := fmt.Sprintf("%04d/%02d%02d", y, m, d)
				suffix := ""
				if date == lastDate {
					n++
					suffix = fmt.Sprintf(".%d", n)
				} else {
					n = 0
				}
				lastDate = date
				f, err := t.Root()
				if err != nil {
					log.Print(err)
				}
				// TODO: Pass times to fs.Add.
				// fmt.Fprintf(os.Stderr, "%v %s %x\n", t.Time, c.Name+"/"+date+suffix+"/"+t.Path, t.Score)
				fs.Add(c.Name+"/"+date+suffix+"/"+t.Path, &fuseNode{f})
			}
		}
	}

	fmt.Fprintf(os.Stderr, "mounting...\n")

	c, err := fuse.Mount(*mtpt)
	if err != nil {
		log.Fatal(err)
	}
	defer exec.Command("umount", *mtpt).Run()

	syscall.Write(stdout, []byte("OK"))
	syscall.Close(stdout)
	c.Serve(fs)
}

type fuseNode struct {
	arq *arq.File
}

func (f *fuseNode) Attr() fuse.Attr {
	de := f.arq.Stat()
	return fuse.Attr{
		Mode:  de.Mode,
		Mtime: de.ModTime,
		Size:  uint64(de.Size),
	}
}

func (f *fuseNode) Lookup(name string, intr fuse.Intr) (fuse.Node, fuse.Error) {
	ff, err := f.arq.Lookup(name)
	if err != nil {
		return nil, fuse.ENOENT
	}
	return &fuseNode{ff}, nil
}

func (f *fuseNode) ReadDir(intr fuse.Intr) ([]fuse.Dirent, fuse.Error) {
	adir, err := f.arq.ReadDir()
	if err != nil {
		return nil, fuse.EIO
	}
	var dir []fuse.Dirent
	for _, ade := range adir {
		dir = append(dir, fuse.Dirent{
			Name: ade.Name,
		})
	}
	return dir, nil
}

// TODO: Implement Read+Release, not ReadAll, to avoid giant buffer.
func (f *fuseNode) ReadAll(intr fuse.Intr) ([]byte, fuse.Error) {
	rc, err := f.arq.Open()
	if err != nil {
		return nil, fuse.EIO
	}
	defer rc.Close()
	data, err := ioutil.ReadAll(rc)
	if err != nil {
		return data, fuse.EIO
	}
	return data, nil
}
