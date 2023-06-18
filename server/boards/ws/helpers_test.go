// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ws

import (
	"testing"

	authMocks "github.com/mattermost/mattermost/server/v8/boards/auth/mocks"
	wsMocks "github.com/mattermost/mattermost/server/v8/boards/ws/mocks"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/golang/mock/gomock"
)

type TestHelper struct {
	api   *wsMocks.MockAPI
	auth  *authMocks.MockAuthInterface
	store *wsMocks.MockStore
	ctrl  *gomock.Controller
	pa    *PluginAdapter
}

func SetupTestHelper(t *testing.T) *TestHelper {
	ctrl := gomock.NewController(t)
	mockAPI := wsMocks.NewMockAPI(ctrl)
	mockAuth := authMocks.NewMockAuthInterface(ctrl)
	mockStore := wsMocks.NewMockStore(ctrl)

	mockAPI.EXPECT().LogDebug(gomock.Any(), gomock.Any()).AnyTimes()
	mockAPI.EXPECT().LogInfo(gomock.Any(), gomock.Any()).AnyTimes()
	mockAPI.EXPECT().LogError(gomock.Any(), gomock.Any()).AnyTimes()
	mockAPI.EXPECT().LogWarn(gomock.Any(), gomock.Any()).AnyTimes()

	return &TestHelper{
		api:   mockAPI,
		auth:  mockAuth,
		store: mockStore,
		ctrl:  ctrl,
		pa:    NewPluginAdapter(mockAPI, mockAuth, mockStore, mlog.CreateConsoleTestLogger(true, mlog.LvlDebug)),
	}
}

func (th *TestHelper) ReceiveWebSocketMessage(webConnID, userID, action string, data map[string]interface{}) {
	req := &mm_model.WebSocketRequest{Action: websocketMessagePrefix + action, Data: data}

	th.pa.WebSocketMessageHasBeenPosted(webConnID, userID, req)
}

func (th *TestHelper) SubscribeWebConnToTeam(webConnID, userID, teamID string) {
	th.auth.EXPECT().
		DoesUserHaveTeamAccess(userID, teamID).
		Return(true)

	msgData := map[string]interface{}{"teamId": teamID}
	th.ReceiveWebSocketMessage(webConnID, userID, websocketActionSubscribeTeam, msgData)
}

func (th *TestHelper) UnsubscribeWebConnFromTeam(webConnID, userID, teamID string) {
	msgData := map[string]interface{}{"teamId": teamID}
	th.ReceiveWebSocketMessage(webConnID, userID, websocketActionUnsubscribeTeam, msgData)
}
