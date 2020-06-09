// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTeamSearchJson(t *testing.T) {
	teamSearch := TeamSearch{Term: NewId()}
	json := teamSearch.ToJson()
	rteamSearch := ChannelSearchFromJson(strings.NewReader(json))

	assert.Equal(t, teamSearch.Term, rteamSearch.Term, "Terms do not match")
}
