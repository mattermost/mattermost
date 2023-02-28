// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGroupSyncableMarshal(t *testing.T) {
	require.NotPanics(t, func() {
		var syncable GroupSyncable
		_, err := json.Marshal(&syncable)
		require.Error(t, err)
		t.Log(err.Error())
	}, "marshaling groupsyncable should not panic")
}
