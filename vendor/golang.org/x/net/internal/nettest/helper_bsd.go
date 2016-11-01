// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build darwin dragonfly freebsd netbsd openbsd

package nettest

import (
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

func supportsIPv6MulticastDeliveryOnLoopback() bool {
	switch runtime.GOOS {
	case "freebsd":
		// See http://www.freebsd.org/cgi/query-pr.cgi?pr=180065.
		// Even after the fix, it looks like the latest
		// kernels don't deliver link-local scoped multicast
		// packets correctly.
		return false
	case "darwin":
		// See http://support.apple.com/kb/HT1633.
		s, err := syscall.Sysctl("kern.osrelease")
		if err != nil {
			return false
		}
		ss := strings.Split(s, ".")
		if len(ss) == 0 {
			return false
		}
		// OS X 10.9 (Darwin 13) or above seems to do the
		// right thing; preserving the packet header as it's
		// needed for the checksum calcuration with pseudo
		// header on loopback multicast delivery process.
		// If not, you'll probably see what is the slow-acting
		// kernel crash caused by lazy mbuf corruption.
		// See ip6_mloopback in netinet6/ip6_output.c.
		if mjver, err := strconv.Atoi(ss[0]); err != nil || mjver < 13 {
			return false
		}
		return true
	default:
		return true
	}
}
