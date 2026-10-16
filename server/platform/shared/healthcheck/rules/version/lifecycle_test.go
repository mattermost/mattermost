// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLookup(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		version    string
		running    string
		belowFloor bool
		ok         bool
	}{
		{version: "11.8.3", running: "11.8", ok: true},
		{version: "12.0.0", running: "12.0", ok: true},
		{version: "11.0.1", running: "11.0", ok: true},
		{version: "10.5.0", running: "10.5", ok: true},
		{version: "10.4.9", belowFloor: true, ok: true},
		{version: "9.11.0", belowFloor: true, ok: true},
		{version: "12.1.0"},
		{version: "11.5.0"},
		{version: "v11.0.1"},
		{version: "11"},
		{version: ""},
	} {
		running, belowFloor, ok := lookup(stubTable, tc.version)
		assert.Equal(t, tc.ok, ok, tc.version)
		assert.Equal(t, tc.belowFloor, belowFloor, tc.version)
		assert.Equal(t, tc.running, running.MajorMinor, tc.version)
	}
}
