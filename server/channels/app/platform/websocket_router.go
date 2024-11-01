// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"net/http"
	"os"
	"fmt"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/slack-go/slack"
)

// SlackMessage represents a message from Slack to be sent over WebSocket
type SlackMessage struct {
	Type    string `json:"type"`
	Channel string `json:"channel"`
	User    string `json:"user"`
	Text    string `json:"text"`
}

// EventType returns the event type for the SlackMessage
func (m *SlackMessage) EventType() string {
	return m.Type
}

func connectToSlackRTM(token string) (*slack.RTM, error) {
	api := slack.New(token)
	rtm := api.NewRTM()
	go rtm.ManageConnection() // Start managing the connection
	return rtm, nil           // Return the RTM instance
}

func handleSlackMessages(rtm *slack.RTM, hub *Hub, conn *WebConn) {
    for msg := range rtm.IncomingEvents {
        switch evt := msg.Data.(type) {
        case *slack.MessageEvent:
            fmt.Printf("Received message from Slack: User: %s, Channel: %s, Text: %s\n", evt.User, evt.Channel, evt.Text)

			responseData := map[string]any{
                "type":    "slack_message",
                "channel": evt.Channel,
                "user":    evt.User,
                "text":    evt.Text,
            }

            response := model.NewWebSocketResponse(model.StatusOk, 0, responseData)

            if hub != nil {
                hub.SendMessage(conn, response)
            } else {
                fmt.Println("Error: Hub is nil")
            }
        }
    }
}

type webSocketHandler interface {
	ServeWebSocket(*WebConn, *model.WebSocketRequest)
}

type WebSocketRouter struct {
	handlers map[string]webSocketHandler
}

func (wr *WebSocketRouter) Handle(action string, handler webSocketHandler) {
	wr.handlers[action] = handler
}

func (wr *WebSocketRouter) ServeWebSocket(conn *WebConn, r *model.WebSocketRequest) {
	if r.Action == "" {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.no_action.app_error", nil, "", http.StatusBadRequest)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}
	slackToken := os.Getenv("SLACK_TOKEN")
	if slackToken == "" {
		fmt.Println("Error: SLACK_TOKEN environment variable is not set.")
		return
	}
	rtm, err := connectToSlackRTM(slackToken)
	hub := conn.Platform.GetHubForUserId(conn.UserId)
	go handleSlackMessages(rtm, hub, conn)
	if err != nil {
		fmt.Println("Error connecting to Slack RTM:", err)
		return
	}

	if r.Seq <= 0 {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_seq.app_error", nil, "", http.StatusBadRequest)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	if r.Action == string(model.WebsocketAuthenticationChallenge) {
		if conn.GetSessionToken() != "" {
			return
		}

		token, ok := r.Data["token"].(string)
		if !ok {
			conn.WebSocket.Close()
			return
		}

		session, err := conn.Suite.GetSession(token)
		if err != nil {
			conn.WebSocket.Close()
			return
		}
		conn.SetSession(session)
		conn.SetSessionToken(session.Token)
		conn.UserId = session.UserId

		conn.Platform.HubRegister(conn)

		conn.Platform.Go(func() {
			conn.Platform.SetStatusOnline(session.UserId, false)
			conn.Platform.UpdateLastActivityAtIfNeeded(*session)
		})

		resp := model.NewWebSocketResponse(model.StatusOk, r.Seq, nil)
		hub := conn.Platform.GetHubForUserId(conn.UserId)
		if hub == nil {
			return
		}
		hub.SendMessage(conn, resp)

		return
	}

	if r.Action == string(model.WebsocketPresenceIndicator) {
		if chID, ok := r.Data["channel_id"].(string); ok {
			// Set active channel
			conn.SetActiveChannelID(chID)
		}
		if teamID, ok := r.Data["team_id"].(string); ok {
			// Set active team
			conn.SetActiveTeamID(teamID)
		}
		if thChannelID, ok := r.Data["thread_channel_id"].(string); ok {
			// Set the channelID of the active thread.
			if isThreadView, ok := r.Data["is_thread_view"].(bool); ok && isThreadView {
				conn.SetActiveThreadViewThreadChannelID(thChannelID)
			} else {
				conn.SetActiveRHSThreadChannelID(thChannelID)
			}
		}

		resp := model.NewWebSocketResponse(model.StatusOk, r.Seq, nil)
		hub := conn.Platform.GetHubForUserId(conn.UserId)
		if hub == nil {
			return
		}
		hub.SendMessage(conn, resp)
		return
	}

	if !conn.IsAuthenticated() {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.not_authenticated.app_error", nil, "", http.StatusUnauthorized)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	handler, ok := wr.handlers[r.Action]
	if !ok {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_action.app_error", nil, "", http.StatusInternalServerError)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	handler.ServeWebSocket(conn, r)
}

func returnWebSocketError(ps *PlatformService, conn *WebConn, r *model.WebSocketRequest, err *model.AppError) {
	logF := mlog.Error
	if err.StatusCode >= http.StatusBadRequest && err.StatusCode < http.StatusInternalServerError {
		logF = mlog.Debug
	}
	logF(
		"websocket routing error.",
		mlog.Int("seq", r.Seq),
		mlog.String("user_id", conn.UserId),
		mlog.String("system_message", err.SystemMessage(i18n.T)),
		mlog.Err(err),
	)

	hub := ps.GetHubForUserId(conn.UserId)
	if hub == nil {
		return
	}

	err.WipeDetailed()
	errorResp := model.NewWebSocketError(r.Seq, err)
	hub.SendMessage(conn, errorResp)
}
