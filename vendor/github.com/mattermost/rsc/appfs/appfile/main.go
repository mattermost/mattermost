// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// appfile is a command-line interface to an appfs file system.
package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/mattermost/rsc/appfs/client"
	"github.com/mattermost/rsc/keychain"
)

var c client.Client

func init() {
	flag.StringVar(&c.Host, "h", "localhost:8080", "app serving host")
	flag.StringVar(&c.User, "u", "", "user name")
	flag.StringVar(&c.Password, "p", "", "password")
}

func usage() {
	fmt.Fprintf(os.Stderr, "usage: appfile [-h host] cmd args...\n")
	fmt.Fprintf(os.Stderr, "\n")
	fmt.Fprintf(os.Stderr, "Commands are:\n")
	for _, c := range cmd {
		fmt.Fprintf(os.Stderr, "\t%s\n", c.name)
	}
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		usage()
	}
	
	if c.Password == "" {
		var err error
		c.User, c.Password, err = keychain.UserPasswd(c.Host, "")
		if err != nil {
			fmt.Fprintf(os.Stderr, "unable to obtain user and password: %s\n", err)
			os.Exit(2)
		}
	}

	name, args := args[0], args[1:]
	for _, c := range cmd {
		if name == c.name {
			switch c.arg {
			case 0, 1:
				if len(args) != c.arg {
					if c.arg == 0 {
						fmt.Fprintf(os.Stderr, "%s takes no arguments\n", name)
						os.Exit(2)
					}
					fmt.Fprintf(os.Stderr, "%s requires 1 argument\n", name)
					os.Exit(2)
				}
			case 2:
				if len(args) == 0 {
					fmt.Fprintf(os.Stderr, "%s requires at least 1 argument\n", name)
					os.Exit(2)
				}
			}
			c.fn(args)
			return
		}
	}
	fmt.Fprintf(os.Stderr, "unknown command %s\n", name)
	os.Exit(2)
}

var cmd = []struct {
	name string
	fn   func([]string)
	arg  int
}{
	{"mkdir", mkdir, 2},
	{"write", write, 1},
	{"read", read, 2},
	{"mkfs", mkfs, 0},
	{"stat", stat, 2},
}

func mkdir(args []string) {
	for _, name := range args {
		if err := c.Create(name, true); err != nil {
			log.Printf("mkdir %s: %v", name, err)
		}
	}
}

func write(args []string) {
	name := args[0]
	data, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		log.Printf("reading stdin: %v", err)
		return
	}
	c.Create(name, false)
	if err := c.Write(name, data); err != nil {
		log.Printf("write %s: %v", name, err)
	}
}

func read(args []string) {
	for _, name := range args {
		fi, err := c.Stat(name)
		if err != nil {
			log.Printf("stat %s: %v", name, err)
			continue
		}
		if fi.IsDir {
			dirs, err := c.ReadDir(name)
			if err != nil {
				log.Printf("read %s: %v", name, err)
				continue
			}
			for _, fi := range dirs {
				fmt.Printf("%+v\n", *fi)
			}
		} else {
			data, err := c.Read(name)
			if err != nil {
				log.Printf("read %s: %v", name, err)
				continue
			}
			os.Stdout.Write(data)
		}
	}
}

func mkfs([]string) {
	if err := c.Mkfs(); err != nil {
		log.Printf("mkfs: %v", err)
	}
}

func stat(args []string) {
	for _, name := range args {
		fi, err := c.Stat(name)
		if err != nil {
			log.Printf("stat %s: %v", name, err)
			continue
		}
		fmt.Printf("%+v\n", *fi)
	}
}
