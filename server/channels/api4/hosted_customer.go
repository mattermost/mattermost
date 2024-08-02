// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

// APIs for self-hosted workspaces to communicate with the backing customer & payments system.
// Endpoints for cloud installations should not go in this file.
func (api *API) InitHostedCustomer() {
	// POST /api/v4/hosted_customer/available
	api.BaseRoutes.HostedCustomer.Handle("/signup_available", api.APISessionRequired(handleSignupAvailable)).Methods(http.MethodGet)
	api.BaseRoutes.HostedCustomer.Handle("/subscribe-newsletter", api.APIHandler(handleSubscribeToNewsletter)).Methods(http.MethodPost)
}

func handleSignupAvailable(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.handleSignupAvailable"
	c.Err = model.NewAppError(where, "api.server.hosted_signup_unavailable.error", nil, "", http.StatusNotImplemented)
}

func handleSubscribeToNewsletter(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.handleSubscribeToNewsletter"
	ensured := ensureCloudInterface(c, where)
	if !ensured {
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	req := new(model.SubscribeNewsletterRequest)
	err = json.Unmarshal(bodyBytes, req)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.request_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	req.ServerID = c.App.Srv().TelemetryId()

	if err := c.App.Cloud().SubscribeToNewsletter("", req); err != nil {
		c.Err = model.NewAppError(where, "api.server.cws.subscribe_to_newsletter.app_error", nil, "CWS Server failed to subscribe to newsletter.", http.StatusInternalServerError).Wrap(err)
		return
	}

	ReturnStatusOK(w)
}
