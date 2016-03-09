// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
)

type ExtraMember struct {
	Id       string `json:"id"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Roles    string `json:"roles"`
	Username string `json:"username"`
}

func (o *ExtraMember) Sanitize(options map[string]bool) {
	if len(options) == 0 || !options["email"] {
		o.Email = ""
	}
}

type ChannelExtra struct {
	Id          string                  `json:"id"`
	Members     map[string]*ExtraMember `json:"members"`
	MemberCount int64                   `json:"member_count"`
}

func (o *ChannelExtra) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelExtraFromJson(data io.Reader) *ChannelExtra {
	decoder := json.NewDecoder(data)
	var o ChannelExtra
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (ce *ChannelExtra) Etag() string {
	ids := []string{}

	for _, m := range ce.Members {
		ids = append(ids, m.Id)
	}

	sort.Strings(ids)

	md5Ids := fmt.Sprintf("%x", md5.Sum([]byte(strings.Join(ids, ""))))

	return fmt.Sprintf("%v.%v.%v.%v", CurrentVersion, ce.Id, strconv.FormatInt(ce.MemberCount, 10), md5Ids)
}
