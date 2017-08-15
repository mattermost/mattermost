// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func GetWebrtcInfoForSession(sessionId string) (*model.WebrtcInfoResponse, *model.AppError) {
	token, err := GetWebrtcToken(sessionId)
	if err != nil {
		return nil, err
	}

	result := &model.WebrtcInfoResponse{
		Token:      token,
		GatewayUrl: *utils.Cfg.WebrtcSettings.GatewayWebsocketUrl,
	}

	if len(*utils.Cfg.WebrtcSettings.StunURI) > 0 {
		result.StunUri = *utils.Cfg.WebrtcSettings.StunURI
	}

	if len(*utils.Cfg.WebrtcSettings.TurnURI) > 0 {
		timestamp := strconv.FormatInt(utils.EndOfDay(time.Now().AddDate(0, 0, 1)).Unix(), 10)
		username := timestamp + ":" + *utils.Cfg.WebrtcSettings.TurnUsername

		result.TurnUri = *utils.Cfg.WebrtcSettings.TurnURI
		result.TurnPassword = GenerateTurnPassword(username, *utils.Cfg.WebrtcSettings.TurnSharedKey)
		result.TurnUsername = username
	}

	return result, nil
}

func GetWebrtcToken(sessionId string) (string, *model.AppError) {
	if !*utils.Cfg.WebrtcSettings.Enable {
		return "", model.NewAppError("WebRTC.getWebrtcToken", "api.webrtc.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	token := base64.StdEncoding.EncodeToString([]byte(sessionId))

	data := make(map[string]string)
	data["janus"] = "add_token"
	data["token"] = token
	data["transaction"] = model.NewId()
	data["admin_secret"] = *utils.Cfg.WebrtcSettings.GatewayAdminSecret

	rq, _ := http.NewRequest("POST", *utils.Cfg.WebrtcSettings.GatewayAdminUrl, strings.NewReader(model.MapToJson(data)))
	rq.Header.Set("Content-Type", "application/json")

	if rp, err := utils.HttpClient(true).Do(rq); err != nil {
		return "", model.NewAppError("WebRTC.Token", "model.client.connecting.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rp.StatusCode >= 300 {
		defer CloseBody(rp)
		return "", model.AppErrorFromJson(rp.Body)
	} else {
		janusResponse := model.GatewayResponseFromJson(rp.Body)
		if janusResponse.Status != "success" {
			return "", model.NewAppError("getWebrtcToken", "api.webrtc.register_token.app_error", nil, "", http.StatusInternalServerError)
		}
	}

	return token, nil
}

func GenerateTurnPassword(username string, secret string) string {
	key := []byte(secret)
	h := hmac.New(sha1.New, key)
	h.Write([]byte(username))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func RevokeWebrtcToken(sessionId string) {
	token := base64.StdEncoding.EncodeToString([]byte(sessionId))
	data := make(map[string]string)
	data["janus"] = "remove_token"
	data["token"] = token
	data["transaction"] = model.NewId()
	data["admin_secret"] = *utils.Cfg.WebrtcSettings.GatewayAdminSecret

	rq, _ := http.NewRequest("POST", *utils.Cfg.WebrtcSettings.GatewayAdminUrl, strings.NewReader(model.MapToJson(data)))
	rq.Header.Set("Content-Type", "application/json")

	// we do not care about the response
	utils.HttpClient(true).Do(rq)
}
