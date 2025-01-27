// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package timeutils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFormatMillis(t *testing.T) {
	t.Run("zero time", func(t *testing.T) {
		result := FormatMillis(0)
		// The concrete time depends on the timezone, so we can't test the exact time
		assert.Contains(t, result, "1970-01-01")
		assert.Contains(t, result, "00:00")
	})

	t.Run("positive time", func(t *testing.T) {
		result := FormatMillis(1609459200000) // 2021-01-01 00:00:00 UTC
		assert.Contains(t, result, "2021-01-01")
		assert.Contains(t, result, "00:00")
	})

	t.Run("negative time", func(t *testing.T) {
		result := FormatMillis(-1609459200000) // 1919-01-01 00:00:00 UTC
		assert.Contains(t, result, "1919-01-01")
		assert.Contains(t, result, "00:00")
	})
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
