// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha512"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const (
	RemoteOfflineAfterMillis = 1000 * 60 * 5 // 5 minutes
)

type RemoteCluster struct {
	RemoteId    string `json:"remote_id"`
	DisplayName string `json:"display_name"`
	SiteURL     string `json:"site_url"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
	Token       string `json:"token"`
	RemoteToken string `json:"remote_token"`
	Topics      string `json:"topics"`
}

func (rc *RemoteCluster) PreSave() {
	if rc.RemoteId == "" {
		rc.RemoteId = NewId()
	}

	if rc.Token == "" {
		rc.Token = NewId()
	}

	if rc.CreateAt == 0 {
		rc.CreateAt = GetMillis()
	}
	rc.fixTopics()
}

func (rc *RemoteCluster) IsValid() *AppError {
	if !IsValidId(rc.RemoteId) {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.id.app_error", nil, "id="+rc.RemoteId, http.StatusBadRequest)
	}

	if rc.DisplayName == "" {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.name.app_error", nil, "display_name empty", http.StatusBadRequest)
	}

	if rc.CreateAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.create_at.app_error", nil, "create_at=0", http.StatusBadRequest)
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

func RemoteClusterFromJSON(data io.Reader) (*RemoteCluster, *AppError) {
	var rc RemoteCluster
	err := json.NewDecoder(data).Decode(&rc)
	if err != nil {
		return nil, NewAppError("RemoteClusterFromJSON", "model.utils.decode_json.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return &rc, nil
}

// RemoteClusterFrame wraps a `RemoteClusterMsg` with credentials specific to a remote cluster.
type RemoteClusterFrame struct {
	RemoteId string            `json:"remote_id"`
	Token    string            `json:"token"`
	Msg      *RemoteClusterMsg `json:"msg"`
}

func (f *RemoteClusterFrame) IsValid() *AppError {
	if !IsValidId(f.RemoteId) {
		return NewAppError("RemoteClusterFrame.IsValid", "api.remote_cluster.invalid_id.app_error", nil, "RemoteId="+f.RemoteId, http.StatusBadRequest)
	}

	if !IsValidId(f.Token) {
		return NewAppError("RemoteClusterFrame.IsValid", "api.remote_cluster.invalid_token.app_error", nil, "", http.StatusBadRequest)
	}

	if f.Msg == nil {
		return NewAppError("RemoteClusterFrame.IsValid", "api.context.invalid_body_param.app_error", map[string]interface{}{"Name": "msg"}, "", http.StatusBadRequest)
	}

	if len(f.Msg.Payload) == 0 {
		return NewAppError("RemoteClusterFrame.IsValid", "api.context.invalid_body_param.app_error", map[string]interface{}{"Name": "msg.payLoad"}, "", http.StatusBadRequest)
	}

	return nil
}

func RemoteClusterFrameFromJSON(data io.Reader) (*RemoteClusterFrame, *AppError) {
	var frame RemoteClusterFrame
	err := json.NewDecoder(data).Decode(&frame)
	if err != nil {
		return nil, NewAppError("RemoteClusterFrameFromJSON", "model.utils.decode_json.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return &frame, nil
}

// RemoteClusterMsg represents a message that is sent and received between clusters.
// These are processed and routed via the RemoteClusters service.
type RemoteClusterMsg struct {
	Id       string          `json:"id"`
	Topic    string          `json:"topic"`
	CreateAt int64           `json:"create_at"`
	Token    string          `json:"token"`
	Payload  json.RawMessage `json:"payload"`
}

func (m *RemoteClusterMsg) IsValid() *AppError {
	if !IsValidId(m.Id) {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_id.app_error", nil, "Id="+m.Id, http.StatusBadRequest)
	}

	if m.Topic == "" {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_topic.app_error", nil, "Topic empty", http.StatusBadRequest)
	}

	if !IsValidId(m.Token) {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_token.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func RemoteClusterMsgFromJSON(data io.Reader) (*RemoteClusterMsg, *AppError) {
	var msg RemoteClusterMsg
	err := json.NewDecoder(data).Decode(&msg)
	if err != nil {
		return nil, NewAppError("RemoteClusterMsgFromJSON", "model.utils.decode_json.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return &msg, nil
}

// RemoteClusterPing represents a ping that is sent and received between clusters
// to indicate a connection is alive. This is the payload for a `RemoteClusterMsg`.
type RemoteClusterPing struct {
	SentAt int64 `json:"sent_at"`
	RecvAt int64 `json:"recv_at"`
}

func RemoteClusterPingFromRawJSON(raw json.RawMessage) (RemoteClusterPing, *AppError) {
	var ping RemoteClusterPing
	err := json.Unmarshal(raw, &ping)
	if err != nil {
		return RemoteClusterPing{}, NewAppError("RemoteClusterPingFromRawJSON", "model.utils.decode_json.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return ping, nil
}

// RemoteClusterInvite represents an invitation to establish a simple trust with a remote cluster.
type RemoteClusterInvite struct {
	RemoteId string `json:"remote_id"`
	SiteURL  string `json:"site_url"`
	Token    string `json:"token"`
}

func RemoteClusterInviteFromRawJSON(raw json.RawMessage) (*RemoteClusterInvite, *AppError) {
	var invite RemoteClusterInvite
	err := json.Unmarshal(raw, &invite)
	if err != nil {
		return nil, NewAppError("RemoteClusterInviteFromRawJSON", "model.utils.decode_json.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	return &invite, nil
}

func (rci *RemoteClusterInvite) Encrypt(password string) ([]byte, error) {
	raw, err := json.Marshal(&rci)
	if err != nil {
		return nil, err
	}

	// hash the pasword to 32 bytes for AES256
	key := sha512.Sum512_256([]byte(password))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// create random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// prefix the nonce to the cyphertext so we don't need to keep track of it.
	return gcm.Seal(nonce, nonce, raw, nil), nil
}

func (rci *RemoteClusterInvite) Decrypt(encrypted []byte, password string) error {
	// hash the pasword to 32 bytes for AES256
	key := sha512.Sum512_256([]byte(password))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	// nonce was prefixed to the cyphertext when encrypting so we need to extract it.
	nonceSize := gcm.NonceSize()
	nonce, cyphertext := encrypted[:nonceSize], encrypted[nonceSize:]

	plain, err := gcm.Open(nil, nonce, cyphertext, nil)
	if err != nil {
		return err
	}

	// try to unmarshall the decrypted JSON to this invite struct.
	return json.Unmarshal(plain, &rci)
}
