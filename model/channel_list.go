// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelList struct {
	Channels []*Channel                `json:"channels"`
	Members  map[string]*ChannelMember `json:"members"`
}

func (o *ChannelList) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *ChannelList) Etag() string {

	id := "0"
	var t int64 = 0
	var delta int64 = 0

	for _, v := range o.Channels {
		if v.LastPostAt > t {
			t = v.LastPostAt
			id = v.Id
		}

		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		}

		member := o.Members[v.Id]

		if member != nil {
			max := v.LastPostAt
			if v.UpdateAt > max {
				max = v.UpdateAt
			}

			delta += max - member.LastViewedAt

			if member.LastViewedAt > t {
				t = member.LastViewedAt
				id = v.Id
			}

			if member.LastUpdateAt > t {
				t = member.LastUpdateAt
				id = v.Id
			}

		}
	}

	return Etag(id, t, delta, len(o.Channels))
}

func ChannelListFromJson(data io.Reader) *ChannelList {
	decoder := json.NewDecoder(data)
	var o ChannelList
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
