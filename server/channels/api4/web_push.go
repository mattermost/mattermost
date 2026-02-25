// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Techzen Web Push API Endpoints

package api4

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitWebPush() {
	api.BaseRoutes.Root.Handle("/api/v4/push/web/subscribe",
		api.APISessionRequired(subscribeWebPush)).Methods(http.MethodPost)
	api.BaseRoutes.Root.Handle("/api/v4/push/web/subscribe",
		api.APISessionRequired(unsubscribeWebPush)).Methods(http.MethodDelete)
	api.BaseRoutes.Root.Handle("/api/v4/push/web/vapid-key",
		api.APISessionRequired(getVAPIDPublicKey)).Methods(http.MethodGet)
}

// subscribeWebPush handles POST /api/v4/push/web/subscribe
func subscribeWebPush(c *Context, w http.ResponseWriter, r *http.Request) {
	var input app.WebPushSubscriptionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		c.SetInvalidParamWithDetails("subscription", err.Error())
		return
	}

	if input.Endpoint == "" || input.Keys.Auth == "" || input.Keys.P256DH == "" {
		c.SetInvalidParam("subscription")
		return
	}

	input.UserAgent = r.UserAgent()

	if appErr := c.App.SaveWebPushSubscription(c.AppContext, c.AppContext.Session().UserId, &input); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// unsubscribeWebPush handles DELETE /api/v4/push/web/subscribe
func unsubscribeWebPush(c *Context, w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Endpoint == "" {
		c.SetInvalidParam("endpoint")
		return
	}

	if appErr := c.App.DeleteWebPushSubscription(c.AppContext, c.AppContext.Session().UserId, body.Endpoint); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// getVAPIDPublicKey handles GET /api/v4/push/web/vapid-key
// Returns the VAPID public key so the client can subscribe.
func getVAPIDPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	key := os.Getenv("MM_PUSH_WEB_VAPID_PUBLIC_KEY")
	if key == "" {
		c.Err = model.NewAppError("getVAPIDPublicKey", "app.web_push.vapid_key_not_configured", nil, "", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"public_key": key})
}
