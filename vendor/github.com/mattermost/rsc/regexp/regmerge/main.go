// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"regexp/syntax"
	"runtime/pprof"
)

var maxState = flag.Int("m", 1e5, "maximum number of states to explore")
var cpuprof = flag.String("cpuprofile", "", "cpu profile file")

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: regmerge [-m maxstate] regexp [regexp2 regexp3....]\n")
		os.Exit(2)
	}
	flag.Parse()

	if len(flag.Args()) < 1 {
		flag.Usage()
	}
	
	os.Exit(run(flag.Args()))
}

func run(args []string) int {
	if *cpuprof != "" {
		f, err := os.Create(*cpuprof)
		if err != nil {
			log.Fatal(err)
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	
	m, err := compile(flag.Args()...)
	if err != nil {
		log.Fatal(err)
	}
	n := 100
	for ;; n *= 2 {
		if n >= *maxState {
			if n >= 2* *maxState {
				fmt.Printf("reached state limit\n")
				return 1
			}
			n = *maxState
		}
		log.Printf("try %d states...\n", n)
		s, err := m.findMatch(n)
		if err == nil {
			fmt.Printf("%q\n", s)
			return 0
		}
		if err != ErrMemory {
			fmt.Printf("failed: %s\n", err)
			return 3
		}
	}
	panic("unreachable")
}

func compile(exprs ...string) (*matcher, error) {
	var progs []*syntax.Prog
	for _, expr := range exprs {
		re, err := syntax.Parse(expr, syntax.Perl)
		if err != nil {
			return nil, err
		}
		sre := re.Simplify()
		prog, err := syntax.Compile(sre)
		if err != nil {
			return nil, err
		}
		if err := toByteProg(prog); err != nil {
			return nil, err
		}
		progs = append(progs, prog)
	}
	m := &matcher{}
	if err := m.init(joinProgs(progs), len(progs)); err != nil {
		return nil, err
	}
	return m, nil
}

func bug() {
	panic("regmerge: internal error")
}
