// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"bytes"
	"fmt"
	"os"
	"runtime/pprof"
	"strings"
)

// goroutineLeakEnvVar opts a test binary into the end-of-run goroutine leak
// report. It is off by default so that no package changes behavior.
const goroutineLeakEnvVar = "MM_TEST_GOROUTINE_LEAK"

// reportGoroutineLeaks writes the runtime's "goroutineleak" profile to stderr
// when MM_TEST_GOROUTINE_LEAK is set to "report" or "fail", and returns the
// number of leaked goroutines found. The profile only contains goroutines
// that are blocked on a channel or sync primitive that no runnable goroutine
// can reach, so it is expected to have few false positives, but it also only
// finds leaks the garbage collector can prove.
func reportGoroutineLeaks() int {
	mode := os.Getenv(goroutineLeakEnvVar)
	if mode != "report" && mode != "fail" {
		return 0
	}

	p := pprof.Lookup("goroutineleak")
	if p == nil {
		fmt.Fprintln(os.Stderr, "goroutineleak profile is not available in this toolchain")
		return 0
	}

	var buf bytes.Buffer
	if err := p.WriteTo(&buf, 1); err != nil {
		fmt.Fprintln(os.Stderr, "failed to write goroutineleak profile:", err)
		return 0
	}

	n := p.Count()
	fmt.Fprintf(os.Stderr, "GOROUTINE LEAK REPORT: %d leaked goroutine(s)\n", n)
	if n > 0 {
		fmt.Fprintln(os.Stderr, strings.TrimSpace(buf.String()))
	}
	return n
}
