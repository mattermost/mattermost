// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPossibleAtMentions(t *testing.T) {
	fixture := []struct {
		message  string
		expected []string
	}{
		{
			"",
			[]string{},
		},
		{
			"@user",
			[]string{"user"},
		},
		{
			"@user-with_special.chars @multiple.-_chars",
			[]string{"user-with_special.chars", "multiple.-_chars"},
		},
		{
			"@repeated @user @repeated",
			[]string{"repeated", "user"},
		},
		{
			"@user1 @user2 @user3",
			[]string{"user1", "user2", "user3"},
		},
		{
			"@李",
			[]string{},
		},
		{
			"@withfinaldot. @withfinaldash- @withfinalunderscore_",
			[]string{
				"withfinaldot.",
				"withfinaldash-",
				"withfinalunderscore_",
			},
		},
	}

	for _, data := range fixture {
		actual := possibleAtMentions(data.message)
		require.ElementsMatch(t, actual, data.expected)
	}
}

func TestTrimUsernameSpecialChar(t *testing.T) {
	fixture := []struct {
		word           string
		expectedString string
		expectedBool   bool
	}{
		{"user...", "user..", true},
		{"user..", "user.", true},
		{"user.", "user", true},
		{"user--", "user-", true},
		{"user-", "user", true},
		{"user_.-", "user_.", true},
		{"user_.", "user_", true},
		{"user_", "user", true},
		{"user", "user", false},
		{"user.with-inner_chars", "user.with.inner.chars", false},
	}

	for _, data := range fixture {
		actualString, actualBool := trimUsernameSpecialChar(data.word)
		require.Equal(t, actualBool, data.expectedBool)
		if actualBool {
			require.Equal(t, actualString, data.expectedString)
		} else {
			require.Equal(t, actualString, data.word)
		}
	}
}
