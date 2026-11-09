// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

const (
	officeIP = "10.1.2.3"
	homeIP   = "203.0.113.9"
)

func setupSessionAttributesWebSocketTest(t *testing.T) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.SessionAttributes = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(t, th.SystemAdminUser, th.BasicChannel)

	return th
}

func setIPAddressAttributeDuration(t *testing.T, th *TestHelper, ttlSeconds, graceSeconds int) {
	t.Helper()

	fields, _, err := th.SystemAdminClient.GetPropertyFields(context.Background(), model.SessionAttributesPropertyGroupName, model.PropertyFieldObjectTypeSession, model.PropertyFieldSearch{
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		PerPage:    100,
	})
	require.NoError(t, err)

	for _, field := range fields {
		if field.Name != model.SessionAttributesPropertyFieldIPAddress {
			continue
		}
		_, _, err = th.SystemAdminClient.PatchPropertyField(context.Background(), model.SessionAttributesPropertyGroupName, model.PropertyFieldObjectTypeSession, field.ID, &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.SAAttrEnabled:            true,
				model.SAAttrTTLSeconds:         ttlSeconds,
				model.SAAttrGracePeriodSeconds: graceSeconds,
			},
		})
		require.NoError(t, err)
		return
	}
	require.FailNow(t, "ip_address session attribute field not found")
}

// allowFileDownloadsWhen stands in for a policy granting download_file_attachment only to
// sessions whose ip_address attribute passes allowed. A session evaluated without the
// attribute is handed nil, so a lapsed attribute shows up as stripped files.
func allowFileDownloadsWhen(t *testing.T, th *TestHelper, allowed func(ip any) bool) {
	t.Helper()

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
	})).Return(func(_ request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
		return model.AccessDecision{Decision: allowed(req.Subject.Session[model.SessionAttributesPropertyFieldIPAddress])}, nil
	})
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil)).Maybe()
	mockACS.On("GetPolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(nil, (*model.AppError)(nil)).Maybe()
	mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Maybe()
}

func postWithFile(t *testing.T, th *TestHelper, message string) *model.Post {
	t.Helper()

	uploaded, _, err := th.SystemAdminClient.UploadFile(context.Background(), []byte("quarterly numbers"), th.BasicChannel.Id, "report.txt")
	require.NoError(t, err)
	post, _, err := th.SystemAdminClient.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   message,
		FileIds:   model.StringArray{uploaded.FileInfos[0].Id},
	})
	require.NoError(t, err)
	return post
}

func postedEventPost(t *testing.T, event *model.WebSocketEvent) *model.Post {
	t.Helper()

	data, ok := event.GetData()["post"].(string)
	require.True(t, ok)
	var post model.Post
	require.NoError(t, json.Unmarshal([]byte(data), &post))
	return &post
}

// eventsUntilPosted returns the post of the posted event for postID and every event before it.
func eventsUntilPosted(t *testing.T, events <-chan *model.WebSocketEvent, postID string) ([]*model.WebSocketEvent, *model.Post) {
	t.Helper()

	var before []*model.WebSocketEvent
	timeout := time.After(10 * time.Second)
	for {
		select {
		case event := <-events:
			if event.EventType() == model.WebsocketEventPosted {
				if post := postedEventPost(t, event); post.Id == postID {
					return before, post
				}
			}
			before = append(before, event)
		case <-timeout:
			require.FailNow(t, "timed out waiting for the posted event", postID)
		}
	}
}

func requireIPAddressPrompt(t *testing.T, event *model.WebSocketEvent) {
	t.Helper()

	require.Equal(t, model.WebsocketEventSessionAttributesExpired, event.EventType())
	require.Equal(t, []any{model.SessionAttributesPropertyFieldIPAddress}, event.GetData()["attributes"])
}

type timedEvent struct {
	at    time.Time
	event *model.WebSocketEvent
}

func TestWebSocketKeepsIdleClientSessionAttributesFresh(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSessionAttributesWebSocketTest(t)
	setIPAddressAttributeDuration(t, th, 1, 8)
	allowFileDownloadsWhen(t, th, func(ip any) bool { return ip != nil })

	// Alice's client answers the prompt the way the webapp does; Bob's ignores it.
	dialedAt := time.Now()
	aliceWS := dialWebSocket(t, th, th.Client.AuthToken, "", "", 0)
	defer aliceWS.conn.Close()

	bobClient := th.CreateClient()
	th.LoginBasic2WithClient(t, bobClient)
	bobWS := dialWebSocket(t, th, bobClient.AuthToken, "", "", 0)
	defer bobWS.conn.Close()

	alicePrompts := make(chan timedEvent, 100)
	alicePosted := make(chan *model.WebSocketEvent, 100)
	go func() {
		for event := range aliceWS.events {
			switch event.EventType() {
			case model.WebsocketEventSessionAttributesExpired:
				alicePrompts <- timedEvent{time.Now(), event}
				_, _, _ = th.Client.GetSessionAttributesManifest(context.Background())
			case model.WebsocketEventPosted:
				alicePosted <- event
			}
		}
	}()

	bobSession, appErr := th.App.GetSession(bobClient.AuthToken)
	require.Nil(t, appErr)
	require.Eventually(t, func() bool {
		attrs, appErr := th.App.GetSessionAttributes(th.Context, bobSession.Id)
		return appErr == nil && attrs == nil
	}, 15*time.Second, 100*time.Millisecond, "bob's idle session attributes should lapse past their grace period")

	post := postWithFile(t, th, "sent once both clients have been idle past the grace period")

	_, alicePost := eventsUntilPosted(t, alicePosted, post.Id)
	require.Len(t, alicePost.Metadata.Files, 1, "alice refreshed her attributes when prompted, so she keeps receiving files")

	bobEvents, bobPost := eventsUntilPosted(t, bobWS.events, post.Id)
	require.Empty(t, bobPost.Metadata.Files)
	require.Equal(t, 1, bobPost.Metadata.RedactedFileCount)

	var prompts []timedEvent
	for len(alicePrompts) > 0 {
		prompts = append(prompts, <-alicePrompts)
	}
	require.GreaterOrEqual(t, len(prompts), 2, "alice is prompted again each time her refreshed attribute's TTL runs out")
	require.Less(t, prompts[0].at.Sub(dialedAt), 3*time.Second, "the prompt comes as the TTL runs out, while the grace period still covers the attribute")
	for _, prompt := range prompts {
		requireIPAddressPrompt(t, prompt.event)
	}

	var bobPrompts []*model.WebSocketEvent
	for _, event := range bobEvents {
		if event.EventType() == model.WebsocketEventSessionAttributesExpired {
			bobPrompts = append(bobPrompts, event)
		}
	}
	require.Len(t, bobPrompts, 1, "a client that never refreshes is not prompted again for the same lapse")
	requireIPAddressPrompt(t, bobPrompts[0])
}

func TestWebSocketPromptsChallengeAuthenticatedClient(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSessionAttributesWebSocketTest(t)
	setIPAddressAttributeDuration(t, th, 1, 8)

	_, _, err := th.Client.GetMe(context.Background(), "")
	require.NoError(t, err)
	refreshedAt := time.Now()

	// The model client authenticates with a challenge once connected, so the connection
	// starts without a session and its first look at the attributes finds nothing.
	ws, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer ws.Close()
	ws.Listen()

	graceEnds := time.After(time.Until(refreshedAt.Add(9 * time.Second)))
	for {
		select {
		case event := <-ws.EventChannel:
			if event.EventType() == model.WebsocketEventSessionAttributesExpired {
				requireIPAddressPrompt(t, event)
				return
			}
		case <-graceEnds:
			require.FailNow(t, "the client was not prompted before its attribute's grace period ended")
		}
	}
}

// rawWebSocket authenticates the upgrade request itself, as the webapp does with its cookie,
// so the request records the session's attributes, and can set X-Forwarded-For to choose
// the network the connection comes from.
type rawWebSocket struct {
	conn    *websocket.Conn
	events  chan *model.WebSocketEvent
	lastSeq int64
}

func dialWebSocket(t *testing.T, th *TestHelper, token, ip, connectionID string, seq int64) *rawWebSocket {
	t.Helper()

	url := fmt.Sprintf("ws://localhost:%v%s/websocket", th.App.Srv().ListenAddr.Port, model.APIURLSuffix)
	if connectionID != "" {
		url += fmt.Sprintf("?connection_id=%s&sequence_number=%d", connectionID, seq)
	}
	header := http.Header{model.HeaderAuth: []string{model.HeaderBearer + " " + token}}
	if ip != "" {
		header.Set("X-Forwarded-For", ip)
	}
	conn, _, err := websocket.DefaultDialer.Dial(url, header)
	require.NoError(t, err)

	ws := &rawWebSocket{conn: conn, events: make(chan *model.WebSocketEvent, 100), lastSeq: -1}
	go func() {
		defer close(ws.events)
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(data))
			if err == nil && event.EventType() != "" {
				ws.events <- event
			}
		}
	}()
	return ws
}

// next returns the next event, tracking the sequence number a resume continues from.
func (ws *rawWebSocket) next(t *testing.T) *model.WebSocketEvent {
	t.Helper()

	select {
	case event, ok := <-ws.events:
		require.True(t, ok, "websocket closed")
		ws.lastSeq = event.GetSequence()
		return event
	case <-time.After(10 * time.Second):
		require.FailNow(t, "timed out waiting for a websocket event")
		return nil
	}
}

func (ws *rawWebSocket) hello(t *testing.T) string {
	t.Helper()

	event := ws.next(t)
	require.Equal(t, model.WebsocketEventHello, event.EventType())
	return event.GetData()["connection_id"].(string)
}

// disconnect closes the socket and waits for the server to hold the connection for resume.
func (ws *rawWebSocket) disconnect(t *testing.T, th *TestHelper, userID string) {
	t.Helper()

	require.NoError(t, ws.conn.Close())
	require.Eventually(t, func() bool {
		return th.App.Srv().Platform().WebConnCountForUser(userID) == 0
	}, 10*time.Second, 50*time.Millisecond)
}

// eventsUntilSentinel posts a message and returns every event that arrives before it.
func (ws *rawWebSocket) eventsUntilSentinel(t *testing.T, th *TestHelper) []*model.WebSocketEvent {
	t.Helper()

	sentinel, _, err := th.SystemAdminClient.CreatePost(context.Background(), &model.Post{ChannelId: th.BasicChannel.Id, Message: "sentinel"})
	require.NoError(t, err)

	var events []*model.WebSocketEvent
	for {
		event := ws.next(t)
		if event.EventType() == model.WebsocketEventPosted && postedEventPost(t, event).Id == sentinel.Id {
			return events
		}
		events = append(events, event)
	}
}

func findPosted(t *testing.T, events []*model.WebSocketEvent, postID string) *model.Post {
	t.Helper()

	for _, event := range events {
		if event.EventType() == model.WebsocketEventPosted {
			if post := postedEventPost(t, event); post.Id == postID {
				return post
			}
		}
	}
	return nil
}

func TestWebSocketResumeRechecksSessionAttributes(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSessionAttributesWebSocketTest(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.TrustedProxyIPHeader = []string{"X-Forwarded-For"}
	})
	allowFileDownloadsWhen(t, th, func(ip any) bool { return ip == officeIP })

	token := th.Client.AuthToken
	userID := th.BasicUser.Id

	t.Run("resumes and replays queued events when reconnecting from the same network", func(t *testing.T) {
		setIPAddressAttributeDuration(t, th, 60, 60)

		ws := dialWebSocket(t, th, token, officeIP, "", 0)
		connectionID := ws.hello(t)
		ws.disconnect(t, th, userID)

		queued := postWithFile(t, th, "posted while alice was offline")

		resumed := dialWebSocket(t, th, token, officeIP, connectionID, ws.lastSeq+1)
		defer resumed.conn.Close()
		events := resumed.eventsUntilSentinel(t, th)

		for _, event := range events {
			require.NotEqual(t, model.WebsocketEventHello, event.EventType(), "a resumed connection keeps its connection id")
		}
		post := findPosted(t, events, queued.Id)
		require.NotNil(t, post, "the event queued while offline should be replayed")
		require.Len(t, post.Metadata.Files, 1)
	})

	t.Run("does not replay queued events after reconnecting from a network the rule denies", func(t *testing.T) {
		setIPAddressAttributeDuration(t, th, 60, 60)

		ws := dialWebSocket(t, th, token, officeIP, "", 0)
		connectionID := ws.hello(t)
		ws.disconnect(t, th, userID)

		queued := postWithFile(t, th, "posted while alice was on the office network")

		reconnected := dialWebSocket(t, th, token, homeIP, connectionID, ws.lastSeq+1)
		defer reconnected.conn.Close()
		require.NotEqual(t, connectionID, reconnected.hello(t), "the client must start over and refetch")
		require.Nil(t, findPosted(t, reconnected.eventsUntilSentinel(t, th), queued.Id))
	})

	t.Run("does not replay queued events when the session cache was cleared just before the drop", func(t *testing.T) {
		setIPAddressAttributeDuration(t, th, 60, 60)

		ws := dialWebSocket(t, th, token, officeIP, "", 0)
		connectionID := ws.hello(t)
		// Let the connect-time status change through first: any event delivered after the
		// invalidation would reload the session and hide the cleared cache.
		select {
		case <-ws.events:
		case <-time.After(500 * time.Millisecond):
		}
		th.App.Srv().Platform().InvalidateChannelCacheForUser(userID)
		ws.disconnect(t, th, userID)

		queued := postWithFile(t, th, "posted while alice was on the office network")

		reconnected := dialWebSocket(t, th, token, homeIP, connectionID, ws.lastSeq+1)
		defer reconnected.conn.Close()
		require.NotEqual(t, connectionID, reconnected.hello(t))
		require.Nil(t, findPosted(t, reconnected.eventsUntilSentinel(t, th), queued.Id))
	})

	t.Run("does not replay queued events once the attributes expired while offline", func(t *testing.T) {
		setIPAddressAttributeDuration(t, th, 1, 3)

		session, appErr := th.App.GetSession(token)
		require.Nil(t, appErr)

		ws := dialWebSocket(t, th, token, officeIP, "", 0)
		connectionID := ws.hello(t)
		ws.disconnect(t, th, userID)

		require.Eventually(t, func() bool {
			attrs, appErr := th.App.GetSessionAttributes(th.Context, session.Id)
			return appErr == nil && attrs == nil
		}, 10*time.Second, 100*time.Millisecond)
		queued := postWithFile(t, th, "posted after alice's attributes expired")

		reconnected := dialWebSocket(t, th, token, officeIP, connectionID, ws.lastSeq+1)
		defer reconnected.conn.Close()
		require.NotEqual(t, connectionID, reconnected.hello(t))
		require.Nil(t, findPosted(t, reconnected.eventsUntilSentinel(t, th), queued.Id))
	})

	t.Run("does not replay queued events once the attributes lapsed before the connection dropped", func(t *testing.T) {
		setIPAddressAttributeDuration(t, th, 1, 2)

		session, appErr := th.App.GetSession(token)
		require.Nil(t, appErr)

		ws := dialWebSocket(t, th, token, officeIP, "", 0)
		connectionID := ws.hello(t)
		require.Eventually(t, func() bool {
			attrs, appErr := th.App.GetSessionAttributes(th.Context, session.Id)
			return appErr == nil && attrs == nil
		}, 10*time.Second, 100*time.Millisecond)
		ws.disconnect(t, th, userID)

		queued := postWithFile(t, th, "posted while alice's attributes had lapsed")

		reconnected := dialWebSocket(t, th, token, officeIP, connectionID, ws.lastSeq+1)
		defer reconnected.conn.Close()
		require.NotEqual(t, connectionID, reconnected.hello(t))
		require.Nil(t, findPosted(t, reconnected.eventsUntilSentinel(t, th), queued.Id))
	})
}
