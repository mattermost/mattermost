// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

type ChannelList []*Channel

func (o *ChannelList) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func (o *ChannelList) Etag() string {

	id := "0"
	var t int64 = 0
	var delta int64 = 0

	for _, v := range *o {
		if v.LastPostAt > t {
			t = v.LastPostAt
			id = v.Id
		}

		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		}

	}

	return Etag(id, t, delta, len(*o))
}

type ChannelListWithTeamData []*ChannelWithTeamData

func (o *ChannelListWithTeamData) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func (o *ChannelListWithTeamData) Etag() string {

	id := "0"
	var t int64 = 0
	var delta int64 = 0

	for _, v := range *o {
		if v.LastPostAt > t {
			t = v.LastPostAt
			id = v.Id
		}

		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		}

		if v.TeamUpdateAt > t {
			t = v.TeamUpdateAt
			id = v.Id
		}
	}

	return Etag(id, t, delta, len(*o))
}
