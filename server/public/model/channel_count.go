// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/md5"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type ChannelCounts struct {
	Counts      map[string]int64 `json:"counts"`
	CountsRoot  map[string]int64 `json:"counts_root"`
	UpdateTimes map[string]int64 `json:"update_times"`
}

func (o *ChannelCounts) Etag() string {
	// we don't include CountsRoot in ETag calculation, since it's a derivative
	ids := []string{}
	for id := range o.Counts {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	str := ""
	var strSb28 strings.Builder
	for _, id := range ids {
		strSb28.WriteString(id + strconv.FormatInt(o.Counts[id], 10))
	}
	str += strSb28.String()

	md5Counts := fmt.Sprintf("%x", md5.Sum([]byte(str)))

	var update int64
	for _, u := range o.UpdateTimes {
		if u > update {
			update = u
		}
	}

	return Etag(md5Counts, update)
}
