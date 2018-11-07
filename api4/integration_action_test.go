// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestOpenDialog(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	WebSocketClient.Listen()

	_, triggerId, err := model.GenerateTriggerId(th.BasicUser.Id, th.App.AsymmetricSigningKey())
	require.Nil(t, err)

	request := model.OpenDialogRequest{
		TriggerId: triggerId,
		URL:       "http://localhost:8065",
		Dialog: model.Dialog{
			CallbackId: "callbackid",
			Title:      "Some Title",
			Elements: []model.DialogElement{
				model.DialogElement{
					DisplayName: "Element Name",
					Name:        "element_name",
					Type:        "text",
					Placeholder: "Enter a value",
				},
			},
			SubmitLabel:    "Submit",
			NotifyOnCancel: false,
			State:          "somestate",
		},
	}

	pass, resp := Client.OpenInteractiveDialog(request)
	CheckNoError(t, resp)
	assert.True(t, pass)

	timeout := time.After(300 * time.Millisecond)
	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.Event == model.WEBSOCKET_EVENT_OPEN_DIALOG {
				waiting = false
			}

		case <-timeout:
			waiting = false
			t.Fatal("should have received open_dialog event")
		}
	}

	// Should fail on bad trigger ID
	request.TriggerId = "junk"
	pass, resp = Client.OpenInteractiveDialog(request)
	CheckBadRequestStatus(t, resp)
	assert.False(t, pass)

	// URL is required
	request.TriggerId = triggerId
	request.URL = ""
	_, resp = Client.OpenInteractiveDialog(request)
	CheckBadRequestStatus(t, resp)
}

func TestSubmitDialog(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	submit := model.SubmitDialogRequest{
		CallbackId: "callbackid",
		State:      "somestate",
		UserId:     th.BasicUser.Id,
		ChannelId:  th.BasicChannel.Id,
		TeamId:     th.BasicTeam.Id,
		Submission: map[string]interface{}{"somename": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.SubmitDialogRequest
		err := json.NewDecoder(r.Body).Decode(&request)
		require.Nil(t, err)
		assert.NotNil(t, request)

		assert.Equal(t, request.URL, "")
		assert.Equal(t, request.UserId, submit.UserId)
		assert.Equal(t, request.ChannelId, submit.ChannelId)
		assert.Equal(t, request.TeamId, submit.TeamId)
		assert.Equal(t, request.CallbackId, submit.CallbackId)
		assert.Equal(t, request.State, submit.State)
		val, ok := request.Submission["somename"].(string)
		require.True(t, ok)
		assert.Equal(t, "somevalue", val)
	}))
	defer ts.Close()

	submit.URL = ts.URL

	pass, resp := Client.SubmitInteractiveDialog(submit)
	CheckNoError(t, resp)
	assert.True(t, pass)

	submit.URL = ""
	pass, resp = Client.SubmitInteractiveDialog(submit)
	CheckBadRequestStatus(t, resp)
	assert.False(t, pass)

	submit.URL = ts.URL
	submit.ChannelId = model.NewId()
	pass, resp = Client.SubmitInteractiveDialog(submit)
	CheckForbiddenStatus(t, resp)
	assert.False(t, pass)

	submit.URL = ts.URL
	submit.ChannelId = th.BasicChannel.Id
	submit.TeamId = model.NewId()
	pass, resp = Client.SubmitInteractiveDialog(submit)
	CheckForbiddenStatus(t, resp)
	assert.False(t, pass)
}
