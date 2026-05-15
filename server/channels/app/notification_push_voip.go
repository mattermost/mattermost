// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	callsVoIPAPNSKeyIDEnv       = "MM_CALLS_VOIP_APNS_KEY_ID"
	callsVoIPAPNSTeamIDEnv      = "MM_CALLS_VOIP_APNS_TEAM_ID"
	callsVoIPAPNSKeyPathEnv     = "MM_CALLS_VOIP_APNS_KEY_PATH"
	callsVoIPAPNSTopicEnv       = "MM_CALLS_VOIP_APNS_TOPIC"
	callsVoIPAPNSEnvironmentEnv = "MM_CALLS_VOIP_APNS_ENV"

	callsVoIPAPNSSandboxEndpoint    = "https://api.sandbox.push.apple.com"
	callsVoIPAPNSProductionEndpoint = "https://api.push.apple.com"
)

var errCallsVoIPAPNSNotConfigured = errors.New("calls voip apns is not configured")

type callsVoIPAPNSConfig struct {
	keyID       string
	teamID      string
	keyPath     string
	topic       string
	environment string
}

type callsVoIPAPNSPayload struct {
	APS    callsVoIPAPNSAPS     `json:"aps"`
	MMVoIP callsVoIPPayloadData `json:"mm_voip"`
}

type callsVoIPAPNSAPS struct {
	ContentAvailable int `json:"content-available"`
}

type callsVoIPPayloadData struct {
	CallID     string `json:"call_id"`
	ChannelID  string `json:"channel_id"`
	ServerURL  string `json:"server_url"`
	CallerName string `json:"caller_name,omitempty"`
}

func (a *App) sendCallsVoIPPushNotification(rctx request.CTX, msg *model.PushNotification, session *model.Session) (bool, error) {
	if msg.SubType != model.PushSubTypeCalls || session == nil {
		return false, nil
	}

	voipDeviceID := session.Props[model.SessionPropVoIPDeviceId]
	if voipDeviceID == "" {
		rctx.Logger().LogM(mlog.MlvlNotificationDebug, "Skipping Calls VoIP push notification",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("reason", "missing_voip_device_id"),
			mlog.String("user_id", session.UserId),
			mlog.String("session_id", session.Id),
		)
		return false, nil
	}

	cfg, err := getCallsVoIPAPNSConfig()
	if errors.Is(err, errCallsVoIPAPNSNotConfigured) {
		rctx.Logger().LogM(mlog.MlvlNotificationDebug, "Skipping Calls VoIP push notification",
			mlog.String("type", model.NotificationTypePush),
			mlog.String("reason", "apns_not_configured"),
			mlog.String("user_id", session.UserId),
			mlog.String("session_id", session.Id),
		)
		return false, nil
	}
	if err != nil {
		return true, err
	}

	_, deviceToken, ok := strings.Cut(voipDeviceID, ":")
	if !ok || deviceToken == "" {
		return true, fmt.Errorf("invalid VoIP device id")
	}

	authToken, err := cfg.authToken()
	if err != nil {
		return true, err
	}

	payload, err := json.Marshal(callsVoIPAPNSPayload{
		APS: callsVoIPAPNSAPS{ContentAvailable: 1},
		MMVoIP: callsVoIPPayloadData{
			CallID:     msg.PostId,
			ChannelID:  msg.ChannelId,
			ServerURL:  a.GetSiteURL(),
			CallerName: msg.SenderName,
		},
	})
	if err != nil {
		return true, fmt.Errorf("failed to encode VoIP APNs payload: %w", err)
	}

	req, err := http.NewRequestWithContext(rctx.Context(), http.MethodPost, cfg.endpoint()+"/3/device/"+deviceToken, bytes.NewReader(payload))
	if err != nil {
		return true, fmt.Errorf("failed to create VoIP APNs request: %w", err)
	}

	req.Header.Set("authorization", "bearer "+authToken)
	req.Header.Set("apns-topic", cfg.topic)
	req.Header.Set("apns-push-type", "voip")
	req.Header.Set("apns-priority", "10")
	req.Header.Set("apns-expiration", "0")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return true, fmt.Errorf("failed to send VoIP APNs request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return true, fmt.Errorf("VoIP APNs returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	rctx.Logger().LogM(mlog.MlvlNotificationDebug, "Calls VoIP APNs request accepted",
		mlog.String("type", model.NotificationTypePush),
		mlog.String("user_id", session.UserId),
		mlog.String("session_id", session.Id),
		mlog.String("channel_id", msg.ChannelId),
		mlog.String("post_id", msg.PostId),
		mlog.String("apns_id", resp.Header.Get("apns-id")),
		mlog.String("apns_environment", cfg.environment),
	)

	return true, nil
}

func getCallsVoIPAPNSConfig() (*callsVoIPAPNSConfig, error) {
	cfg := &callsVoIPAPNSConfig{
		keyID:       os.Getenv(callsVoIPAPNSKeyIDEnv),
		teamID:      os.Getenv(callsVoIPAPNSTeamIDEnv),
		keyPath:     os.Getenv(callsVoIPAPNSKeyPathEnv),
		topic:       os.Getenv(callsVoIPAPNSTopicEnv),
		environment: strings.ToLower(os.Getenv(callsVoIPAPNSEnvironmentEnv)),
	}

	if cfg.environment == "" {
		cfg.environment = "sandbox"
	}

	if cfg.keyID == "" || cfg.teamID == "" || cfg.keyPath == "" || cfg.topic == "" {
		return nil, errCallsVoIPAPNSNotConfigured
	}

	if cfg.environment != "sandbox" && cfg.environment != "production" {
		return nil, fmt.Errorf("invalid %s value %q", callsVoIPAPNSEnvironmentEnv, cfg.environment)
	}

	return cfg, nil
}

func (c *callsVoIPAPNSConfig) endpoint() string {
	if c.environment == "production" {
		return callsVoIPAPNSProductionEndpoint
	}
	return callsVoIPAPNSSandboxEndpoint
}

func (c *callsVoIPAPNSConfig) authToken() (string, error) {
	keyBytes, err := os.ReadFile(c.keyPath)
	if err != nil {
		return "", fmt.Errorf("failed to read VoIP APNs key: %w", err)
	}

	key, err := jwt.ParseECPrivateKeyFromPEM(keyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse VoIP APNs key: %w", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"iss": c.teamID,
		"iat": time.Now().Unix(),
	})
	token.Header["kid"] = c.keyID

	return token.SignedString(key)
}
