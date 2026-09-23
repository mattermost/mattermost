// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timeutils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFormatMillis(t *testing.T) {
	assert.Equal(t, "1970-01-01T00:00:00Z", FormatMillis(0))
	assert.Equal(t, "2021-01-01T00:00:00.123Z", FormatMillis(1609459200123))
	assert.Equal(t, "1919-01-01T00:00:00Z", FormatMillis(-1609459200000))
}

func TestParseFormatedMillis(t *testing.T) {
	t.Run("empty string", func(t *testing.T) {
		result, err := ParseFormatedMillis("")
		assert.NoError(t, err)
		assert.Equal(t, int64(0), result)
	})

	t.Run("valid timestamp", func(t *testing.T) {
		result, err := ParseFormatedMillis("2021-01-01T00:00:00.000Z")
		assert.NoError(t, err)
		assert.Equal(t, int64(1609459200000), result)
	})

	t.Run("invalid format", func(t *testing.T) {
		result, err := ParseFormatedMillis("2021-01-01")
		assert.Error(t, err)
		assert.Equal(t, int64(0), result)
	})

	t.Run("invalid date", func(t *testing.T) {
		result, err := ParseFormatedMillis("2021-13-01T00:00:00.000Z")
		assert.Error(t, err)
		assert.Equal(t, int64(0), result)
	})
}
