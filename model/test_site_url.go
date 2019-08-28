// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TestSiteURL struct {
	SiteURL string `json:"site_url"`
}

func (me *TestSiteURL) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func TestSiteURLFromJson(data io.Reader) *TestSiteURL {
	var me *TestSiteURL
	json.NewDecoder(data).Decode(&me)
	return me
}
