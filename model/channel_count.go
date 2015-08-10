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
	Counts map[string]int64 `json:"counts"`
}

func (o *ChannelCounts) Etag() string {
	str := ""
	for id, count := range o.Counts {
		str += id + strconv.FormatInt(count, 10)
	}

	data := []byte(str)

	return Etag(md5.Sum(data))
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
