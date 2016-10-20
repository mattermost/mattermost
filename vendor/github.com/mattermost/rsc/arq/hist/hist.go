// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Hist shows the history of a given file, using Arq backups.

    usage: hist [-d] [-h host] [-m mtpt] [-s yyyy/mmdd] file ...

The -d flag causes it to show diffs between successive versions.

By default, hist assumes backups are mounted at mtpt/host, where
mtpt defaults to /mnt/arq and host is the first element of the local host name.
Hist starts the file list with the present copy of the file.

The -h and -s flags override these assumptions.

*/
package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

var usageString = `usage: hist [-d] [-h host] [-m mtpt] [-s yyyy/mmdd] file ...

Hist lists the known versions of the given file.
The -d flag causes it to show diffs between successive versions.

By default, hist assumes backups are mounted at mtpt/host, where
mtpt defaults to /mnt/arq and host is the first element of the local host name.
Hist starts the file list with the present copy of the file.

The -h and -s flags override these assumptions.
`

var (
	diff = flag.Bool("d", false, "diff")
	host = flag.String("h", defaultHost(), "host name")
	mtpt = flag.String("m", "/mnt/arq", "mount point")
	vers = flag.String("s", "", "version")
)

func defaultHost() string {
	name, _ := os.Hostname()
	if name == "" {
		name = "gnot"
	}
	if i := strings.Index(name, "."); i >= 0 {
		name = name[:i]
	}
	return name
}

func main() {
	flag.Usage = func() {
		fmt.Fprint(os.Stderr, usageString)
		os.Exit(2)
	}
	
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		flag.Usage()
	}
	
	dates := loadDates()
	for _, file := range args {
		list(dates, file)
	}
}

var (
	yyyy = regexp.MustCompile(`^\d{4}$`)
	mmdd = regexp.MustCompile(`^\d{4}(\.\d+)?$`)
)

func loadDates() []string {
	var all []string
	ydir, err := ioutil.ReadDir(filepath.Join(*mtpt, *host))
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(3)
	}
	for _, y := range ydir {
		if !y.IsDir() || !yyyy.MatchString(y.Name()) {
			continue
		}
		ddir, err := ioutil.ReadDir(filepath.Join(*mtpt, *host, y.Name()))
		if err != nil {
			continue
		}
		for _, d := range ddir {
			if !d.IsDir() || !mmdd.MatchString(d.Name()) {
				continue
			}
			date := y.Name() + "/" + d.Name()
			if *vers > date {
				continue
			}
			all = append(all, filepath.Join(*mtpt, *host, date))
		}
	}
	return all
}		

const timeFormat = "Jan 02 15:04:05 MST 2006"

func list(dates []string, file string) {
	var (
		last os.FileInfo
		lastPath string
	)

	fi, err := os.Stat(file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "hist: warning: %s: %v\n", file, err)
	} else {
		fmt.Printf("%s %s %d\n", fi.ModTime().Format(timeFormat), file, fi.Size())
		last = fi
		lastPath = file
	}
	
	file, err = filepath.Abs(file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "hist: abs: %v\n", err)
		return
	}

	for i := len(dates)-1; i >= 0; i-- {
		p := filepath.Join(dates[i], file)
		fi, err := os.Stat(p)
		if err != nil {
			continue
		}
		if last != nil && fi.ModTime() == last.ModTime() && fi.Size() == last.Size() {
			continue
		}
		if *diff {
			cmd := exec.Command("diff", lastPath, p)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "%s\n", err)
			}
			cmd.Wait()
		}
		fmt.Printf("%s %s %d\n", fi.ModTime().Format(timeFormat), p, fi.Size())
		last = fi
		lastPath = p
	}
}

