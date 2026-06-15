// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package safemapstructure

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDecodeNoMatchesCase(t *testing.T) {
	type Test struct {
		Test      string `mapstructure:"test"`
		OtherTest string `mapstructure:"other_test"`
	}

	input := map[string]interface{}{
		"tEst":       "incorrect",
		"Test":       "incorrect",
		"Other_test": "incorrect",
		"other_tEst": "incorrect",
	}

	var output Test
	err := Decode(input, &output)
	require.Nil(t, err)

	require.Equal(t, "", output.Test)
	require.Equal(t, "", output.OtherTest)
}

func TestDecodeHasMatch(t *testing.T) {
	type Test struct {
		Test      string `mapstructure:"test"`
		OtherTest string `mapstructure:"other_test"`
	}

	input := map[string]interface{}{
		"tEst":       "incorrect",
		"test":       "correct1",
		"other_test": "correct2",
		"other_tEst": "incorrect",
	}

	// Do it a bunch of times since map order is randomized
	for i := 0; i < 100; i++ {
		var output Test
		err := Decode(input, &output)
		require.Nil(t, err)

		require.Equal(t, "correct1", output.Test)
		require.Equal(t, "correct2", output.OtherTest)
	}
}
