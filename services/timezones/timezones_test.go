// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timezones

import (
	"testing"

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
