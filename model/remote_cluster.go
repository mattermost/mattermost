// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

const (
	REMOTE_OFFLINE_AFTER_MILLIS = 1000 * 60 * 30 // 30 minutes
)

type RemoteCluster struct {
	Id          string `json:"id"`
	ClusterName string `json:"cluster_name"`
	Hostname    string `json:"hostname"`
	Port        int32  `json:"port"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
	Token       string `json:"token"`
}

func (rc *RemoteCluster) PreSave() {
	if rc.Id == "" {
		rc.Id = NewId()
	}

	if rc.CreateAt == 0 {
		rc.CreateAt = GetMillis()
	}

	if rc.LastPingAt == 0 {
		rc.LastPingAt = rc.CreateAt
	}
}

func (rc *RemoteCluster) IsValid() *AppError {
	if !IsValidId(rc.Id) {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(rc.ClusterName) == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.name.app_error", nil, "", http.StatusBadRequest)
	}

	if len(rc.Hostname) == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.hostname.app_error", nil, "", http.StatusBadRequest)
	}

	if rc.CreateAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if rc.LastPingAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.last_ping_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (rc *RemoteCluster) ToJson() string {
	b, err := json.Marshal(rc)
	if err != nil {
		return ""
	}

	return string(b)
}

func RemoteClusterFromJson(data io.Reader) *RemoteCluster {
	decoder := json.NewDecoder(data)
	var rc RemoteCluster
	err := decoder.Decode(&rc)
	if err == nil {
		return &rc
	}

	return nil
}
