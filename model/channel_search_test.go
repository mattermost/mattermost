// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestChannelSearchJson(t *testing.T) {
	channelSearch := ChannelSearch{Term: NewId()}
	json := channelSearch.ToJson()
	rchannelSearch := ChannelSearchFromJson(strings.NewReader(json))

	if channelSearch.Term != rchannelSearch.Term {
		t.Fatal("Terms do not match")
	}
}
