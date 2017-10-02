// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestChannelViewJson(t *testing.T) {
	o := ChannelView{ChannelId: NewId(), PrevChannelId: NewId()}
	json := o.ToJson()
	ro := ChannelViewFromJson(strings.NewReader(json))

	if o.ChannelId != ro.ChannelId {
		t.Fatal("ChannelIdIds do not match")
	}

	if o.PrevChannelId != ro.PrevChannelId {
		t.Fatal("PrevChannelIds do not match")
	}
}

func TestChannelViewResponseJson(t *testing.T) {
	id := NewId()
	o := ChannelViewResponse{Status: "OK", LastViewedAtTimes: map[string]int64{id: 12345}}
	json := o.ToJson()
	ro := ChannelViewResponseFromJson(strings.NewReader(json))

	if o.Status != ro.Status {
		t.Fatal("ChannelIdIds do not match")
	}

	if o.LastViewedAtTimes[id] != ro.LastViewedAtTimes[id] {
		t.Fatal("LastViewedAtTimes do not match")
	}
}
