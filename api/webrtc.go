// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/tls"
	"encoding/base64"
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func InitWebrtc() {
	l4g.Debug(utils.T("api.webrtc.init.debug"))

	BaseRoutes.Webrtc.Handle("/token", ApiUserRequired(webrtcToken)).Methods("POST")

	BaseRoutes.WebSocket.Handle("webrtc", ApiWebSocketHandler(webrtcMessage))
}

func webrtcToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if token, err := getWebrtcToken(c.Session.Id); err != nil {
		c.Err = err
		return
	} else {
		result := make(map[string]string)
		result["token"] = token
		result["gateway_url"] = *utils.Cfg.WebrtcSettings.GatewayWebsocketUrl

		if len(*utils.Cfg.WebrtcSettings.StunURI) > 0 {
			result["stun_uri"] = *utils.Cfg.WebrtcSettings.StunURI
		}

		if len(*utils.Cfg.WebrtcSettings.TurnURI) > 0 {
			timestamp := strconv.FormatInt(utils.EndOfDay(time.Now().AddDate(0, 0, 1)).Unix(), 10)
			username := timestamp + ":" + *utils.Cfg.WebrtcSettings.TurnUsername

			result["turn_uri"] = *utils.Cfg.WebrtcSettings.TurnURI
			result["turn_password"] = generateTurnPassword(username, *utils.Cfg.WebrtcSettings.TurnSharedKey)
			result["turn_username"] = username
		}
		w.Write([]byte(model.MapToJson(result)))
	}
}

func webrtcMessage(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var toUserId string
	if toUserId, ok = req.Data["to_user_id"].(string); !ok || len(toUserId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "to_user_id")
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_WEBRTC, "", "", toUserId, nil)
	event.Data = req.Data
	go Publish(event)

	return nil, nil
}

func getWebrtcToken(sessionId string) (string, *model.AppError) {
	if !*utils.Cfg.WebrtcSettings.Enable {
		return "", model.NewLocAppError("WebRTC.getWebrtcToken", "api.webrtc.disabled.app_error", nil, "")
	}

	token := base64.StdEncoding.EncodeToString([]byte(sessionId))

	data := make(map[string]string)
	data["janus"] = "add_token"
	data["token"] = token
	data["transaction"] = model.NewId()
	data["admin_secret"] = *utils.Cfg.WebrtcSettings.GatewayAdminSecret

	rq, _ := http.NewRequest("POST", *utils.Cfg.WebrtcSettings.GatewayAdminUrl, strings.NewReader(model.MapToJson(data)))
	rq.Header.Set("Content-Type", "application/json")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	httpClient := &http.Client{Transport: tr}
	if rp, err := httpClient.Do(rq); err != nil {
		return "", model.NewLocAppError("WebRTC.Token", "model.client.connecting.app_error", nil, err.Error())
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return "", model.AppErrorFromJson(rp.Body)
	} else {
		janusResponse := model.GatewayResponseFromJson(rp.Body)
		if janusResponse.Status != "success" {
			return "", model.NewLocAppError("getWebrtcToken", "api.webrtc.register_token.app_error", nil, "")
		}
	}

	return token, nil
}

func generateTurnPassword(username string, secret string) string {
	key := []byte(secret)
	h := hmac.New(sha1.New, key)
	h.Write([]byte(username))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
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
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	httpClient := &http.Client{Transport: tr}
	httpClient.Do(rq)
}
