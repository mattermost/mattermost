// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTeamSearchJson(t *testing.T) {
	teamSearch := TeamSearch{Term: NewId()}
	var rteamSearch *ChannelSearch
	err := json.Unmarshal([]byte(teamSearch.ToJson()), &rteamSearch)
	require.NoError(t, err)

	assert.Equal(t, teamSearch.Term, rteamSearch.Term, "Terms do not match")
}
