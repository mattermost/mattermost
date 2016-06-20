// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// S3get fetches a single object from or lists the objects in an S3 bucket.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/mattermost/rsc/keychain"
	"launchpad.net/goamz/aws"
	"launchpad.net/goamz/s3"
)

var list = flag.Bool("l", false, "list buckets")
var delim = flag.String("d", "", "list delimiter")

func usage() {
	fmt.Fprintf(os.Stderr, `usage: s3get [-l] bucket path

s3get fetches a single object from or lists the objects
in an S3 bucket.

The -l flag causes s3get to list available paths.
When using -l, path may be omitted.
Otherwise the listing begins at path.

s3get uses the user name and password in the local
keychain for the server 's3.amazonaws.com' as the S3
access key (user name) and secret key (password).
`)
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()
	var buck, obj string
	args := flag.Args()
	switch len(args) {
	case 1:
		buck = args[0]
		if !*list {
			fmt.Fprintf(os.Stderr, "must specify path when not using -l")
			os.Exit(2)
		}
	case 2:
		buck = args[0]
		obj = args[1]
	default:
		usage()
	}

	access, secret, err := keychain.UserPasswd("s3.amazonaws.com", "")
	if err != nil {
		log.Fatal(err)
	}

	auth := aws.Auth{AccessKey: access, SecretKey: secret}

	b := s3.New(auth, aws.USEast).Bucket(buck)
	if *list {
		objs, prefixes, err := b.List("", *delim, obj, 0)
		if err != nil {
			log.Fatal(err)
		}
		for _, p := range prefixes {
			fmt.Printf("%s\n", p)
		}
		for _, obj := range objs {
			fmt.Printf("%s\n", obj.Key)
		}
		return
	}

	data, err := b.Get(obj)
	if err != nil {
		log.Fatal(err)
	}
	os.Stdout.Write(data)
}
