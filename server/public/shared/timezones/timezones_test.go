// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timezones

import (
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimezoneConfig(t *testing.T) {
	tz1 := New()
	assert.NotEmpty(t, tz1.GetSupported())
}

func TestDefaultUserTimezone(t *testing.T) {
	defaultTimezone := DefaultUserTimezone()
	require.Equal(t, "true", defaultTimezone["useAutomaticTimezone"])
	require.Empty(t, defaultTimezone["automaticTimezone"])
	require.Empty(t, defaultTimezone["manualTimezone"])

	defaultTimezone["useAutomaticTimezone"] = "false"
	defaultTimezone["automaticTimezone"] = "EST"
	defaultTimezone["manualTimezone"] = "AST"

	defaultTimezone2 := DefaultUserTimezone()
	require.Equal(t, "true", defaultTimezone2["useAutomaticTimezone"])
	require.Empty(t, defaultTimezone2["automaticTimezone"])
	require.Empty(t, defaultTimezone2["manualTimezone"])
}

func TestDefaultSupportedTimezonesAreLoadable(t *testing.T) {
	// The list is served from GET /api/v4/system/timezones, so a name the Go
	// runtime cannot load is a name a client can pick and then fail on.
	for _, name := range DefaultSupportedTimezones {
		_, err := time.LoadLocation(name)
		assert.NoError(t, err, "timezone %q is offered but cannot be loaded", name)
	}
}

func TestDefaultSupportedTimezonesAreSortedAndUnique(t *testing.T) {
	require.True(t, sort.StringsAreSorted(DefaultSupportedTimezones), "list is not sorted")

	seen := make(map[string]bool, len(DefaultSupportedTimezones))
	for _, name := range DefaultSupportedTimezones {
		require.False(t, seen[name], "duplicate timezone %q", name)
		seen[name] = true
	}
}
