// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChannelViewJson(t *testing.T) {
	o := ChannelView{ChannelId: NewId(), PrevChannelId: NewId()}
	json := o.ToJson()
	ro := ChannelViewFromJson(strings.NewReader(json))

	assert.Equal(t, o.ChannelId, ro.ChannelId, "ChannelIdIds do not match")
	assert.Equal(t, o.PrevChannelId, ro.PrevChannelId, "PrevChannelIds do not match")
}

func TestChannelViewResponseJson(t *testing.T) {
	id := NewId()
	o := ChannelViewResponse{Status: "OK", LastViewedAtTimes: map[string]int64{id: 12345}}
	json := o.ToJson()
	ro := ChannelViewResponseFromJson(strings.NewReader(json))

	assert.Equal(t, o.Status, ro.Status, "ChannelIdIds do not match")
	assert.Equal(t, o.LastViewedAtTimes[id], ro.LastViewedAtTimes[id], "LastViewedAtTimes do not match")
}
