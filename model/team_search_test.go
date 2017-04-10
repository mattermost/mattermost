// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestTeamSearchJson(t *testing.T) {
	teamSearch := TeamSearch{Term: NewId()}
	json := teamSearch.ToJson()
	rteamSearch := ChannelSearchFromJson(strings.NewReader(json))

	if teamSearch.Term != rteamSearch.Term {
		t.Fatal("Terms do not match")
	}
}
