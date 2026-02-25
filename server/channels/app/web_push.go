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
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// WebPushSubscription represents a browser push subscription stored in DB.
type WebPushSubscription struct {
	Id        string `db:"Id"`
	UserId    string `db:"UserId"`
	Endpoint  string `db:"Endpoint"`
	Auth      string `db:"Auth"`
	P256DH    string `db:"P256DH"`
	UserAgent string `db:"UserAgent"`
	CreatedAt int64  `db:"CreatedAt"`
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

func getSqlStore(a *App) (*sqlstore.SqlStore, bool) {
	ss, ok := a.Srv().Store().(*sqlstore.SqlStore)
	return ss, ok
}

// SaveWebPushSubscription stores a browser subscription for a user.
func (a *App) SaveWebPushSubscription(rctx request.CTX, userID string, input *WebPushSubscriptionInput) *model.AppError {
	ss, ok := getSqlStore(a)
	if !ok {
		return model.NewAppError("SaveWebPushSubscription", "app.web_push.store.app_error", nil, "could not get SqlStore", http.StatusInternalServerError)
	}

	sub := &WebPushSubscription{
		Id:        model.NewId(),
		UserId:    userID,
		Endpoint:  input.Endpoint,
		Auth:      input.Keys.Auth,
		P256DH:    input.Keys.P256DH,
		UserAgent: input.UserAgent,
		CreatedAt: model.GetMillis(),
	}

	_, err := ss.GetMaster().NamedExec(
		`INSERT INTO WebPushSubscriptions (Id, UserId, Endpoint, Auth, P256DH, UserAgent, CreatedAt)
		 VALUES (:Id, :UserId, :Endpoint, :Auth, :P256DH, :UserAgent, :CreatedAt)
		 ON CONFLICT (UserId, Endpoint) DO UPDATE
		 SET Auth = EXCLUDED.Auth, P256DH = EXCLUDED.P256DH, UserAgent = EXCLUDED.UserAgent, CreatedAt = EXCLUDED.CreatedAt`,
		sub,
	)
	if err != nil {
		return model.NewAppError("SaveWebPushSubscription", "app.web_push.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeleteWebPushSubscription removes a browser subscription for a user.
func (a *App) DeleteWebPushSubscription(rctx request.CTX, userID string, endpoint string) *model.AppError {
	ss, ok := getSqlStore(a)
	if !ok {
		return model.NewAppError("DeleteWebPushSubscription", "app.web_push.store.app_error", nil, "could not get SqlStore", http.StatusInternalServerError)
	}

	_, err := ss.GetMaster().Exec(
		`DELETE FROM WebPushSubscriptions WHERE UserId = $1 AND Endpoint = $2`,
		userID, endpoint,
	)
	if err != nil {
		return model.NewAppError("DeleteWebPushSubscription", "app.web_push.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// getWebPushSubscriptionsForUser fetches all browser subscriptions for a user.
func (a *App) getWebPushSubscriptionsForUser(userID string) ([]*WebPushSubscription, *model.AppError) {
	ss, ok := getSqlStore(a)
	if !ok {
		return nil, model.NewAppError("getWebPushSubscriptionsForUser", "app.web_push.store.app_error", nil, "could not get SqlStore", http.StatusInternalServerError)
	}

	var subs []*WebPushSubscription
	err := ss.GetReplica().Select(
		&subs,
		`SELECT Id, UserId, Endpoint, Auth, P256DH, UserAgent, CreatedAt
		 FROM WebPushSubscriptions WHERE UserId = $1`,
		userID,
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
		payload.URL = "/channels/" + msg.ChannelName
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
				P256dh: sub.P256DH,
			},
		}

		resp, err := webpush.SendNotification(payloadBytes, subscription, &webpush.Options{
			VAPIDPublicKey:  vapidPublicKey,
			VAPIDPrivateKey: vapidPrivateKey,
			Subscriber:      vapidSubject,
			TTL:             30,
		})
		if err != nil {
			epLen := len(sub.Endpoint)
			if epLen > 40 {
				epLen = 40
			}
			rctx.Logger().Warn("[WebPush] Failed to send notification",
				mlog.String("user_id", userID),
				mlog.String("endpoint", sub.Endpoint[:epLen]),
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
