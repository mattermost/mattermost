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
		version    line
		running    string
		belowFloor bool
		ok         bool
	}{
		{version: line{11, 8}, running: "11.8", ok: true},
		{version: line{12, 0}, running: "12.0", ok: true},
		{version: line{11, 0}, running: "11.0", ok: true},
		{version: line{10, 5}, running: "10.5", ok: true},
		{version: line{10, 4}, belowFloor: true, ok: true},
		{version: line{9, 11}, belowFloor: true, ok: true},
		{version: line{12, 1}},
		{version: line{11, 5}},
	} {
		running, belowFloor, ok := lookup(stubTable, tc.version)
		assert.Equal(t, tc.ok, ok, tc.version.String())
		assert.Equal(t, tc.belowFloor, belowFloor, tc.version.String())
		assert.Equal(t, tc.running, running.MajorMinor, tc.version.String())
	}
}
