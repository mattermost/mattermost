// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hosts

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsLocal(t *testing.T) {
	for host, want := range map[string]bool{
		"localhost":         true,
		"LocalHost":         true,
		"localhost.":        true,
		"es.localhost":      true,
		"127.0.0.1":         true,
		"127.1.2.3":         true,
		"0.0.0.0":           true,
		"::1":               true,
		"[::1]":             true,
		"::":                true,
		"":                  false,
		"db.example.com":    false,
		"localhost.example": false,
		"10.0.0.5":          false,
		"[2001:db8::1]":     false,
	} {
		assert.Equal(t, want, IsLocal(host), host)
	}
}
