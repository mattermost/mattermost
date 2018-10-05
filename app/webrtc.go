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

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) GetWebrtcInfoForSession(sessionId string) (*model.WebrtcInfoResponse, *model.AppError) {
	token, err := a.GetWebrtcToken(sessionId)
	if err != nil {
		return nil, err
	}

	result := &model.WebrtcInfoResponse{
		Token:      token,
		GatewayUrl: *a.Config().WebrtcSettings.GatewayWebsocketUrl,
	}

	if len(*a.Config().WebrtcSettings.StunURI) > 0 {
		result.StunUri = *a.Config().WebrtcSettings.StunURI
	}

	if len(*a.Config().WebrtcSettings.TurnURI) > 0 {
		timestamp := strconv.FormatInt(utils.EndOfDay(time.Now().AddDate(0, 0, 1)).Unix(), 10)
		username := timestamp + ":" + *a.Config().WebrtcSettings.TurnUsername

		result.TurnUri = *a.Config().WebrtcSettings.TurnURI
		result.TurnPassword = GenerateTurnPassword(username, *a.Config().WebrtcSettings.TurnSharedKey)
		result.TurnUsername = username
	}

	return result, nil
}

func (a *App) GetWebrtcToken(sessionId string) (string, *model.AppError) {
	if !*a.Config().WebrtcSettings.Enable {
		return "", model.NewAppError("WebRTC.getWebrtcToken", "api.webrtc.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	token := base64.StdEncoding.EncodeToString([]byte(sessionId))

	data := make(map[string]string)
	data["janus"] = "add_token"
	data["token"] = token
	data["transaction"] = model.NewId()
	data["admin_secret"] = *a.Config().WebrtcSettings.GatewayAdminSecret

	rq, _ := http.NewRequest("POST", *a.Config().WebrtcSettings.GatewayAdminUrl, strings.NewReader(model.MapToJson(data)))
	rq.Header.Set("Content-Type", "application/json")

	if rp, err := a.HTTPService.MakeClient(true).Do(rq); err != nil {
		return "", model.NewAppError("WebRTC.Token", "model.client.connecting.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rp.StatusCode >= 300 {
		defer consumeAndClose(rp)
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

func (a *App) RevokeWebrtcToken(sessionId string) {
	token := base64.StdEncoding.EncodeToString([]byte(sessionId))
	data := make(map[string]string)
	data["janus"] = "remove_token"
	data["token"] = token
	data["transaction"] = model.NewId()
	data["admin_secret"] = *a.Config().WebrtcSettings.GatewayAdminSecret

	rq, _ := http.NewRequest("POST", *a.Config().WebrtcSettings.GatewayAdminUrl, strings.NewReader(model.MapToJson(data)))
	rq.Header.Set("Content-Type", "application/json")

	// we do not care about the response
	a.HTTPService.MakeClient(true).Do(rq)
}
