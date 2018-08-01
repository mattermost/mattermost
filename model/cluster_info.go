// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ClusterInfo struct {
	Id         string `json:"id"`
	Version    string `json:"version"`
	ConfigHash string `json:"config_hash"`
	IpAddress  string `json:"ipaddress"`
	Hostname   string `json:"hostname"`
}

func (me *ClusterInfo) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func ClusterInfoFromJson(data io.Reader) *ClusterInfo {
	var me *ClusterInfo
	json.NewDecoder(data).Decode(&me)
	return me
}

func ClusterInfosToJson(objmap []*ClusterInfo) string {
	b, _ := json.Marshal(objmap)
	return string(b)
}

func ClusterInfosFromJson(data io.Reader) []*ClusterInfo {
	decoder := json.NewDecoder(data)

	var objmap []*ClusterInfo
	if err := decoder.Decode(&objmap); err != nil {
		return make([]*ClusterInfo, 0)
	} else {
		return objmap
	}
}
