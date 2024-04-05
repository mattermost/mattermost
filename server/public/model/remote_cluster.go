// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"golang.org/x/crypto/scrypt"
)

const (
	RemoteOfflineAfterMillis = 1000 * 60 * 5 // 5 minutes
	RemoteNameMinLength      = 1
	RemoteNameMaxLength      = 64

	SiteURLPending = "pending_"
	SiteURLPlugin  = "plugin_"

	BitflagOptionAutoShareDMs Bitmask = 1 << iota // Any new DM/GM is automatically shared
	BitflagOptionAutoInvited                      // Remote is automatically invited to all shared channels
)

var (
	validRemoteNameChars = regexp.MustCompile(`^[a-zA-Z0-9\.\-\_]+$`)
)

type Bitmask uint32

func (bm *Bitmask) IsBitSet(flag Bitmask) bool {
	return *bm != 0
}

func (bm *Bitmask) SetBit(flag Bitmask) {
	*bm |= flag
}

func (bm *Bitmask) UnsetBit(flag Bitmask) {
	*bm &= ^flag
}

type RemoteCluster struct {
	RemoteId     string  `json:"remote_id"`
	RemoteTeamId string  `json:"remote_team_id"`
	Name         string  `json:"name"`
	DisplayName  string  `json:"display_name"`
	SiteURL      string  `json:"site_url"`
	CreateAt     int64   `json:"create_at"`
	LastPingAt   int64   `json:"last_ping_at"`
	Token        string  `json:"token"`
	RemoteToken  string  `json:"remote_token"`
	Topics       string  `json:"topics"`
	CreatorId    string  `json:"creator_id"`
	PluginID     string  `json:"plugin_id"` // non-empty when sync message are to be delivered via plugin API
	Options      Bitmask `json:"options"`   // bit-flag set of options
}

func (rc *RemoteCluster) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"remote_id":      rc.RemoteId,
		"remote_team_id": rc.RemoteTeamId,
		"name":           rc.Name,
		"display_name":   rc.DisplayName,
		"site_url":       rc.SiteURL,
		"create_at":      rc.CreateAt,
		"last_ping_at":   rc.LastPingAt,
		"creator_id":     rc.CreatorId,
		"plugin_id":      rc.PluginID,
		"options":        rc.Options,
	}
}

func (rc *RemoteCluster) PreSave() {
	if rc.RemoteId == "" {
		rc.RemoteId = NewId()
	}

	if rc.DisplayName == "" {
		rc.DisplayName = rc.Name
	}

	rc.Name = SanitizeUnicode(rc.Name)
	rc.DisplayName = SanitizeUnicode(rc.DisplayName)
	rc.Name = NormalizeRemoteName(rc.Name)

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

	if !IsValidRemoteName(rc.Name) {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.name.app_error", nil, "name="+rc.Name, http.StatusBadRequest)
	}

	if rc.CreateAt == 0 {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.create_at.app_error", nil, "create_at=0", http.StatusBadRequest)
	}

	if !IsValidId(rc.CreatorId) {
		return NewAppError("RemoteCluster.IsValid", "model.cluster.is_valid.id.app_error", nil, "creator_id="+rc.CreatorId, http.StatusBadRequest)
	}
	return nil
}

func (rc *RemoteCluster) IsOptionFlagSet(flag Bitmask) bool {
	return rc.Options.IsBitSet(flag)
}

func (rc *RemoteCluster) SetOptionFlag(flag Bitmask) {
	rc.Options.SetBit(flag)
}

func (rc *RemoteCluster) UnsetOptionFlag(flag Bitmask) {
	rc.Options.UnsetBit(flag)
}

func IsValidRemoteName(s string) bool {
	if len(s) < RemoteNameMinLength || len(s) > RemoteNameMaxLength {
		return false
	}
	return validRemoteNameChars.MatchString(s)
}

func (rc *RemoteCluster) PreUpdate() {
	if rc.DisplayName == "" {
		rc.DisplayName = rc.Name
	}

	rc.Name = SanitizeUnicode(rc.Name)
	rc.DisplayName = SanitizeUnicode(rc.DisplayName)
	rc.Name = NormalizeRemoteName(rc.Name)
	rc.fixTopics()
}

func (rc *RemoteCluster) IsOnline() bool {
	return rc.LastPingAt > GetMillis()-RemoteOfflineAfterMillis
}

func (rc *RemoteCluster) IsConfirmed() bool {
	if rc.IsPlugin() {
		return true // local plugins are automatically confirmed
	}

	if rc.SiteURL != "" && !strings.HasPrefix(rc.SiteURL, SiteURLPending) {
		return true // empty or pending siteurl are not confirmed
	}
	return false
}

func (rc *RemoteCluster) IsPlugin() bool {
	if rc.PluginID != "" || strings.HasPrefix(rc.SiteURL, SiteURLPlugin) {
		return true // local plugins are automatically confirmed
	}
	return false
}

func (rc *RemoteCluster) GetSiteURL() string {
	siteURL := rc.SiteURL
	if strings.HasPrefix(siteURL, SiteURLPending) {
		siteURL = "..."
	}
	if strings.HasPrefix(siteURL, SiteURLPending) || strings.HasPrefix(siteURL, SiteURLPlugin) {
		siteURL = "plugin"
	}
	return siteURL
}

// fixTopics ensures all topics are separated by one, and only one, space.
func (rc *RemoteCluster) fixTopics() {
	trimmed := strings.TrimSpace(rc.Topics)
	if trimmed == "" || trimmed == "*" {
		rc.Topics = trimmed
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

func (rc *RemoteCluster) ToRemoteClusterInfo() RemoteClusterInfo {
	return RemoteClusterInfo{
		Name:        rc.Name,
		DisplayName: rc.DisplayName,
		CreateAt:    rc.CreateAt,
		LastPingAt:  rc.LastPingAt,
	}
}

func NormalizeRemoteName(name string) string {
	return strings.ToLower(name)
}

// RemoteClusterInfo provides a subset of RemoteCluster fields suitable for sending to clients.
type RemoteClusterInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
}

// RemoteClusterFrame wraps a `RemoteClusterMsg` with credentials specific to a remote cluster.
type RemoteClusterFrame struct {
	RemoteId string           `json:"remote_id"`
	Msg      RemoteClusterMsg `json:"msg"`
}

func (f *RemoteClusterFrame) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"remote_id": f.RemoteId,
		"msg":       f.Msg,
	}
}

func (f *RemoteClusterFrame) IsValid() *AppError {
	if !IsValidId(f.RemoteId) {
		return NewAppError("RemoteClusterFrame.IsValid", "api.remote_cluster.invalid_id.app_error", nil, "RemoteId="+f.RemoteId, http.StatusBadRequest)
	}

	if appErr := f.Msg.IsValid(); appErr != nil {
		return appErr
	}

	return nil
}

// RemoteClusterMsg represents a message that is sent and received between clusters.
// These are processed and routed via the RemoteClusters service.
type RemoteClusterMsg struct {
	Id       string          `json:"id"`
	Topic    string          `json:"topic"`
	CreateAt int64           `json:"create_at"`
	Payload  json.RawMessage `json:"payload"`
}

func NewRemoteClusterMsg(topic string, payload json.RawMessage) RemoteClusterMsg {
	return RemoteClusterMsg{
		Id:       NewId(),
		Topic:    topic,
		CreateAt: GetMillis(),
		Payload:  payload,
	}
}

func (m RemoteClusterMsg) IsValid() *AppError {
	if !IsValidId(m.Id) {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_id.app_error", nil, "Id="+m.Id, http.StatusBadRequest)
	}

	if m.Topic == "" {
		return NewAppError("RemoteClusterMsg.IsValid", "api.remote_cluster.invalid_topic.app_error", nil, "Topic empty", http.StatusBadRequest)
	}

	if len(m.Payload) == 0 {
		return NewAppError("RemoteClusterMsg.IsValid", "api.context.invalid_body_param.app_error", map[string]any{"Name": "PayLoad"}, "", http.StatusBadRequest)
	}

	return nil
}

// RemoteClusterPing represents a ping that is sent and received between clusters
// to indicate a connection is alive. This is the payload for a `RemoteClusterMsg`.
type RemoteClusterPing struct {
	SentAt int64 `json:"sent_at"`
	RecvAt int64 `json:"recv_at"`
}

// RemoteClusterInvite represents an invitation to establish a simple trust with a remote cluster.
type RemoteClusterInvite struct {
	RemoteId     string `json:"remote_id"`
	RemoteTeamId string `json:"remote_team_id"`
	SiteURL      string `json:"site_url"`
	Token        string `json:"token"`
}

func (rci *RemoteClusterInvite) Encrypt(password string) ([]byte, error) {
	raw, err := json.Marshal(&rci)
	if err != nil {
		return nil, err
	}

	// create random salt to be prepended to the blob.
	salt := make([]byte, 16)
	if _, err = io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	key, err := scrypt.Key([]byte(password), salt, 32768, 8, 1, 32)
	if err != nil {
		return nil, err
	}

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
	sealed := gcm.Seal(nonce, nonce, raw, nil)

	return append(salt, sealed...), nil //nolint:makezero
}

func (rci *RemoteClusterInvite) Decrypt(encrypted []byte, password string) error {
	if len(encrypted) <= 16 {
		return errors.New("invalid length")
	}

	// first 16 bytes is the salt that was used to derive a key
	salt := encrypted[:16]
	encrypted = encrypted[16:]

	key, err := scrypt.Key([]byte(password), salt, 32768, 8, 1, 32)
	if err != nil {
		return err
	}

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

// RemoteClusterQueryFilter provides filter criteria for RemoteClusterStore.GetAll
type RemoteClusterQueryFilter struct {
	ExcludeOffline bool
	InChannel      string
	NotInChannel   string
	Topic          string
	CreatorId      string
	OnlyConfirmed  bool
	PluginID       string
	RequireOptions Bitmask
}
