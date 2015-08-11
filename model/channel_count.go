// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"crypto/md5"
	"encoding/json"
	"io"
	"strconv"
)

type ChannelCounts struct {
	Counts      map[string]int64 `json:"counts"`
	UpdateTimes map[string]int64 `json:"update_times"`
}

func (o *ChannelCounts) Etag() string {
	str := ""
	for id, count := range o.Counts {
		str += id + strconv.FormatInt(count, 10)
	}

	md5Counts := md5.Sum([]byte(str))

	var update int64 = 0
	for _, u := range o.UpdateTimes {
		if u > update {
			update = u
		}
	}

	return Etag(md5Counts, update)
}

func (o *ChannelCounts) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelCountsFromJson(data io.Reader) *ChannelCounts {
	decoder := json.NewDecoder(data)
	var o ChannelCounts
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
