// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestWebrtcToken(t *testing.T) {
	th := Setup().InitBasic()

	*utils.Cfg.WebrtcSettings.Enable = false
	if _, err := th.BasicClient.GetWebrtcToken(); err == nil {
		t.Fatal("should have failed")
	}

	*utils.Cfg.WebrtcSettings.Enable = true
	*utils.Cfg.WebrtcSettings.GatewayAdminUrl = "https://dockerhost:7089/admin"
	*utils.Cfg.WebrtcSettings.GatewayWebsocketUrl = "wss://dockerhost:8189"
	*utils.Cfg.WebrtcSettings.GatewayAdminSecret = "janusoverlord"
	*utils.Cfg.WebrtcSettings.StunURI = "stun:dockerhost:5349"
	*utils.Cfg.WebrtcSettings.TurnURI = "turn:dockerhost:5349"
	*utils.Cfg.WebrtcSettings.TurnUsername = "test"
	*utils.Cfg.WebrtcSettings.TurnSharedKey = "mattermost"
	*utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections = true
	sessionId := model.NewId()
	if result, err := th.BasicClient.GetWebrtcToken(); err != nil {
		t.Fatal(err)
	} else {
		fmt.Println("Token", result["token"])
		fmt.Println("Gateway Websocket", result["gateway_url"])
		fmt.Println("Stun URI", result["stun_uri"])
		fmt.Println("Turn URI", result["turn_uri"])
		fmt.Println("Turn Username", result["turn_username"])
		fmt.Println("Turn Password", result["turn_password"])
	}

	RevokeWebrtcToken(sessionId)
}
