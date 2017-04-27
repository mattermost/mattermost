// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	CDS_OFFLINE_AFTER_MILLIS = 1000 * 60 * 15 // 15 minutes
	CDS_TYPE_APP             = "mattermost_app"
)

type ClusterDiscovery struct {
	Id          string `json:"id"`
	Type        string `json:"type"`
	ClusterName string `json:"cluster_name"`
	Hostname    string `json:"hostname"`
	Port        string `json:"port"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
}

func (o *ClusterDiscovery) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
		o.LastPingAt = o.CreateAt
	}
}

func (o *ClusterDiscovery) IsValid() *AppError {
	if len(o.Id) != 26 {
		return NewLocAppError("Channel.IsValid", "model.channel.is_valid.id.app_error", nil, "")
	}

	if len(o.ClusterName) == 0 {
		return NewLocAppError("ClusterDiscovery.IsValid", "ClusterName must be set", nil, "")
	}

	if len(o.Type) == 0 {
		return NewLocAppError("ClusterDiscovery.IsValid", "Type must be set", nil, "")
	}

	if len(o.Hostname) == 0 {
		return NewLocAppError("ClusterDiscovery.IsValid", "Hostname must be set", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("ClusterDiscovery.IsValid", "CreateAt must be set", nil, "")
	}

	if o.LastPingAt == 0 {
		return NewLocAppError("ClusterDiscovery.IsValid", "LastPingAt must be set", nil, "")
	}

	return nil
}

func (o *ClusterDiscovery) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	}

	return string(b)
}

func ClusterDiscoveryFromJson(data io.Reader) *ClusterDiscovery {
	decoder := json.NewDecoder(data)
	var me ClusterDiscovery
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	}

	return nil
}
