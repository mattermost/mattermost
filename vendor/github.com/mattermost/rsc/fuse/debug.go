// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// FUSE service loop, for servers that wish to use it.

package fuse

import (
	"runtime"
)

func stack() string {
	buf := make([]byte, 1024)
	return string(buf[:runtime.Stack(buf, false)])
}

var Debugf = nop

func nop(string, ...interface{}) {}
