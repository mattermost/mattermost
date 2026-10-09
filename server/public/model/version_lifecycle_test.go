// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"cmp"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func compareMajorMinor(a, b string) int {
	aMajor, aMinor, _ := SplitVersion(a)
	bMajor, bMinor, _ := SplitVersion(b)
	return cmp.Or(cmp.Compare(aMajor, bMajor), cmp.Compare(aMinor, bMinor))
}

func TestReleaseLifecycles(t *testing.T) {
	lifecycles := ReleaseLifecycles()
	require.NotEmpty(t, lifecycles)
	floor := lifecycles[len(lifecycles)-1]
	require.True(t, floor.ESR, "the oldest entry must be an ESR")

	t.Run("every version at or above the floor has an entry", func(t *testing.T) {
		entries := map[string]bool{}
		for _, lifecycle := range lifecycles {
			entries[lifecycle.MajorMinor] = true
		}

		for _, version := range versions {
			major, minor, _ := SplitVersion(version)
			majorMinor := fmt.Sprintf("%d.%d", major, minor)
			if compareMajorMinor(majorMinor, floor.MajorMinor) < 0 {
				continue
			}
			assert.True(t, entries[majorMinor], "%s has no release lifecycle entry", majorMinor)
		}
	})

	t.Run("entries are newest first", func(t *testing.T) {
		for i := 1; i < len(lifecycles); i++ {
			assert.Positive(t, compareMajorMinor(lifecycles[i-1].MajorMinor, lifecycles[i].MajorMinor),
				"%s must come before %s", lifecycles[i-1].MajorMinor, lifecycles[i].MajorMinor)
		}
	})

	t.Run("only ESRs have an EOL date", func(t *testing.T) {
		for _, lifecycle := range lifecycles {
			assert.Equal(t, lifecycle.ESR, !lifecycle.EOLDate.IsZero(), lifecycle.MajorMinor)
		}
	})

	t.Run("returns a copy", func(t *testing.T) {
		copied := ReleaseLifecycles()
		copied[0].ESR = !copied[0].ESR
		assert.NotEqual(t, copied[0].ESR, ReleaseLifecycles()[0].ESR)
	})
}
