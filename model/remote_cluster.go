// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const (
	RemoteOfflineAfterMillis = 1000 * 60 * 30 // 30 minutes
)

type RemoteCluster struct {
	Id          string `json:"id"`
	ClusterName string `json:"cluster_name"`
	Hostname    string `json:"hostname"`
	Port        int32  `json:"port"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
	Token       string `json:"token"`
	Topics      string `json:"topics"`
}

func (rc *RemoteCluster) PreSave() {
	if rc.Id == "" {
		rc.Id = NewId()
	}

	if rc.Token == "" {
		rc.Token = NewId()
	}

	if rc.CreateAt == 0 {
		rc.CreateAt = GetMillis()
	}

	if rc.LastPingAt == 0 {
		rc.LastPingAt = rc.CreateAt
	}
	rc.fixTopics()
}

func (rc *RemoteCluster) IsValid() *AppError {
	if !IsValidId(rc.Id) {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.id.app_error", nil, "id="+rc.Id, http.StatusBadRequest)
	}

	if rc.ClusterName == "" {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.name.app_error", nil, "cluster_name empty", http.StatusBadRequest)
	}

	if rc.Hostname == "" {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.hostname.app_error", nil, "host_name empty", http.StatusBadRequest)
	}

	if rc.CreateAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.create_at.app_error", nil, "create_at=0", http.StatusBadRequest)
	}

	if rc.LastPingAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.last_ping_at.app_error", nil, "last_ping_at=0", http.StatusBadRequest)
	}

	return nil
}

func (rc *RemoteCluster) PreUpdate() {
	rc.fixTopics()
}

// fixTopics ensures all topics are separated by one, and only one, space.
func (rc *RemoteCluster) fixTopics() {
	trimmed := strings.TrimSpace(rc.Topics)
	if trimmed == "" {
		rc.Topics = ""
		return
	}
	if trimmed == "*" {
		rc.Topics = "*"
		return
	}

	var sb strings.Builder
	sb.WriteString(" ")

	ss := strings.Split(rc.Topics, " ")
	for _, c := range ss {
		cc := strings.TrimSpace(c)
		if cc != "" {
			sb.WriteString(cc)
			sb.WriteString(" ")
		}
	}
	rc.Topics = sb.String()
}

func (rc *RemoteCluster) ToJSON() (string, error) {
	b, err := json.Marshal(rc)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func RemoteClusterFromJSON(data io.Reader) (*RemoteCluster, error) {
	decoder := json.NewDecoder(data)
	var rc RemoteCluster
	err := decoder.Decode(&rc)
	return &rc, err
}

// RemoteClusterMsg represents a message that is sent and received between clusters.
// These are processed and routed via the RemoteClusters service.
type RemoteClusterMsg struct {
	Id string
	RemoteId
	Topic    string
	CreateAt int64
	Token    string
	Payload  json.RawMessage
}

func (m *RemoteClusterMsg) IsValid() *AppError {
	if !IsValidId(m.Id) {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_id.app_error", nil, "Id="+m.Id, http.StatusBadRequest)
	}

	if m.Topic == "" {
		return NewAppError("RemoteCluster.IsValid", "api.remote_cluster.invalid_topic.app_error", nil, "Topic empty", http.StatusBadRequest)
	}

	if !IsValidId(m.Token) {
		return NewAppError("RemoteCluster.IsValid", "api.remote_cluster.invalid_token.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func (m *RemoteClusterMsg) ToJSON() (string, error) {
	b, err := json.Marshal(m)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func RemoteClusterMsgFromJSON(data io.Reader) (*RemoteClusterMsg, *AppError) {
	decoder := json.NewDecoder(data)
	var msg RemoteClusterMsg
	err := decoder.Decode(&msg)
	if err != nil {
		return nil, NewAppError("RemoteClusterMsgFromJSON", "model.utils.decode_json.app_error", nil, "", http.StatusBadRequest)
	}
	return &msg, nil
}

type RemoteClusterPing struct {
	RemoteId string
	Token    string
	SentAt   int64
	RecvAt   int64
}

func RemoteClusterPingFromJSON(data io.Reader) (RemoteClusterPing, *AppError) {
	decoder := json.NewDecoder(data)
	var ping RemoteClusterPing
	err := decoder.Decode(&ping)
	if err != nil {
		return RemoteClusterPing{}, NewAppError("RemoteClusterPingFromJSON", "model.utils.decode_json.app_error", nil, "", http.StatusBadRequest)
	}
	return ping, nil
}
