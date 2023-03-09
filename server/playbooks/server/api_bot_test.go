// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
)

func TestTrialLicences(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("request trial license without permissions", func(t *testing.T) {
		dialogRequest := model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			PostId: e.BasicPublicChannelPost.Id,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		resp, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/bot/notify-admins/button-start-trial", dialogRequestBytes, "")
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("request trial license with permissions", func(t *testing.T) {
		dialogRequest := model.PostActionIntegrationRequest{
			UserId: e.AdminUser.Id,
			PostId: e.BasicPublicChannelPost.Id,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		resp, err := e.ServerAdminClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+"playbooks"+"/api/v0/bot/notify-admins/button-start-trial", dialogRequestBytes, "")
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
