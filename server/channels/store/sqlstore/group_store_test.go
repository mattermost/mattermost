// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestGroupStore(t *testing.T) {
	StoreTest(t, storetest.TestGroupStore)
}

func TestGroupSearchPattern(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	testCases := []struct {
		name     string
		term     string
		expected string
	}{
		{"bare term", "designteam", "%designteam%"},
		{"mention", "@designteam", "%designteam%"},
		{"only the leading mention marker is dropped", "@@designteam", "%@designteam%"},
		{"an interior marker is kept", "sales@emea", "%sales@emea%"},
		{"leading marker dropped, interior kept", "@sales@emea", "%sales@emea%"},
		{"lone marker matches everything", "@", "%%"},
		{"wildcards are still escaped", "@50%_off", "%50\\%\\_off%"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, groupSearchPattern(tc.term))
		})
	}
}
