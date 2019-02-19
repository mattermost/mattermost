// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package timezones

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTimezoneConfig(t *testing.T) {
	tz1 := New("timezones.json")
	assert.NotEmpty(t, tz1.GetSupported())

	tz2 := New("timezones_file_does_not_exists.json")
	assert.Equal(t, DefaultSupportedTimezones, tz2.GetSupported())
}
