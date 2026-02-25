// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Techzen Web Push (VAPID) Implementation

package app

import (
	"encoding/json"
	"net/http"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// WebPushSubscription represents a browser push subscription stored in DB.
type WebPushSubscription struct {
	Id        string `json:"id"`
	UserId    string `json:"user_id"`
	Endpoint  string `json:"endpoint"`
	Auth      string `json:"auth"`
	P256DH    string `json:"p256dh"`
	UserAgent string `json:"user_agent"`
	CreatedAt int64  `json:"created_at"`
}

// WebPushSubscriptionInput is the payload from the browser's pushManager.subscribe()
type WebPushSubscriptionInput struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		Auth   string `json:"auth"`
		P256DH string `json:"p256dh"`
	} `json:"keys"`
	UserAgent string `json:"user_agent"`
}

// WebPushPayload is what we send to the browser via sw.js 'push' event.
type WebPushPayload struct {
	Title   string `json:"title"`
	Body    string `json:"body"`
	Tag     string `json:"tag"`
	URL     string `json:"url"`
	Channel string `json:"channel"`
}

// SaveWebPushSubscription stores a browser subscription for a user.
func (a *App) SaveWebPushSubscription(rctx request.CTX, userID string, input *WebPushSubscriptionInput) *model.AppError {
	sub := &WebPushSubscription{
		Id:        model.NewId(),
		UserId:    userID,
		Endpoint:  input.Endpoint,
		Auth:      input.Keys.Auth,
		P256DH:    input.Keys.P256DH,
		UserAgent: input.UserAgent,
		CreatedAt: model.GetMillis(),
	}

	_, err := a.Srv().Store().GetMaster().Exec(
		`INSERT INTO WebPushSubscriptions (Id, UserId, Endpoint, Auth, P256DH, UserAgent, CreatedAt)
		 VALUES (:Id, :UserId, :Endpoint, :Auth, :P256DH, :UserAgent, :CreatedAt)
		 ON CONFLICT (UserId, Endpoint) DO UPDATE
		 SET Auth = EXCLUDED.Auth, P256DH = EXCLUDED.P256DH, UserAgent = EXCLUDED.UserAgent, CreatedAt = EXCLUDED.CreatedAt`,
		map[string]interface{}{
			"Id": sub.Id, "UserId": sub.UserId, "Endpoint": sub.Endpoint,
			"Auth": sub.Auth, "P256DH": sub.P256DH, "UserAgent": sub.UserAgent,
			"CreatedAt": sub.CreatedAt,
		},
	)
	if err != nil {
		return model.NewAppError("SaveWebPushSubscription", "app.web_push.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeleteWebPushSubscription removes a browser subscription for a user.
func (a *App) DeleteWebPushSubscription(rctx request.CTX, userID string, endpoint string) *model.AppError {
	_, err := a.Srv().Store().GetMaster().Exec(
		`DELETE FROM WebPushSubscriptions WHERE UserId = :UserId AND Endpoint = :Endpoint`,
		map[string]interface{}{"UserId": userID, "Endpoint": endpoint},
	)
	if err != nil {
		return model.NewAppError("DeleteWebPushSubscription", "app.web_push.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// getWebPushSubscriptionsForUser fetches all browser subscriptions for a user.
func (a *App) getWebPushSubscriptionsForUser(userID string) ([]*WebPushSubscription, *model.AppError) {
	var subs []*WebPushSubscription
	_, err := a.Srv().Store().GetReplica().Select(
		&subs,
		`SELECT Id, UserId, Endpoint, Auth, P256DH, UserAgent, CreatedAt
		 FROM WebPushSubscriptions WHERE UserId = :UserId`,
		map[string]interface{}{"UserId": userID},
	)
	if err != nil {
		return nil, model.NewAppError("getWebPushSubscriptionsForUser", "app.web_push.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return subs, nil
}

// sendWebPushToSubscriptions sends a VAPID web push notification to all
// browser subscriptions of the given user. Called alongside mobile push.
func (a *App) sendWebPushToSubscriptions(rctx request.CTX, msg *model.PushNotification, userID string) {
	vapidPublicKey := os.Getenv("MM_PUSH_WEB_VAPID_PUBLIC_KEY")
	vapidPrivateKey := os.Getenv("MM_PUSH_WEB_VAPID_PRIVATE_KEY")
	vapidSubject := os.Getenv("MM_PUSH_WEB_VAPID_SUBJECT")

	if vapidPublicKey == "" || vapidPrivateKey == "" {
		// VAPID not configured, skip silently
		return
	}
	if vapidSubject == "" {
		vapidSubject = "mailto:admin@techzen.vn"
	}

	subs, appErr := a.getWebPushSubscriptionsForUser(userID)
	if appErr != nil || len(subs) == 0 {
		return
	}

	payload := WebPushPayload{
		Title:   "Techzen Chat",
		Body:    msg.Message,
		Tag:     "techzen-" + msg.ChannelId,
		URL:     "/",
		Channel: msg.ChannelId,
	}
	if msg.SenderName != "" {
		payload.Title = msg.SenderName
	}
	if msg.ChannelName != "" {
		payload.URL = "/" + msg.TeamName + "/channels/" + msg.ChannelName
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		rctx.Logger().Warn("[WebPush] Failed to marshal payload", mlog.Err(err))
		return
	}

	for _, sub := range subs {
		subscription := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				Auth:   sub.Auth,
				P256DH: sub.P256DH,
			},
		}

		resp, err := webpush.SendNotification(payloadBytes, subscription, &webpush.Options{
			VAPIDPublicKey:  vapidPublicKey,
			VAPIDPrivateKey: vapidPrivateKey,
			Subscriber:      vapidSubject,
			TTL:             30,
		})
		if err != nil {
			rctx.Logger().Warn("[WebPush] Failed to send notification",
				mlog.String("user_id", userID),
				mlog.String("endpoint", sub.Endpoint[:min(len(sub.Endpoint), 40)]),
				mlog.Err(err),
			)
			continue
		}
		defer resp.Body.Close()

		// 410 Gone = subscription expired, clean up
		if resp.StatusCode == http.StatusGone {
			_ = a.DeleteWebPushSubscription(rctx, userID, sub.Endpoint)
			rctx.Logger().Info("[WebPush] Removed expired subscription",
				mlog.String("user_id", userID),
			)
			continue
		}

		rctx.Logger().Debug("[WebPush] Notification sent",
			mlog.String("user_id", userID),
			mlog.Int("status", resp.StatusCode),
		)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
