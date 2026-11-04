// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package hosts classifies host names read from config.
package hosts

import (
	"net"
	"strings"
)

// IsLocal reports whether host names this machine: localhost, a *.localhost name, or a loopback or unspecified IP.
// host carries no port; IPv6 brackets and a trailing dot are allowed.
func IsLocal(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(strings.Trim(host, "[]")), ".")
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}

	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsUnspecified())
}
