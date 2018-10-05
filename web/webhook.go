// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (w *Web) InitWebhooks() {
	w.MainRouter.Handle("/hooks/commands/{id:[A-Za-z0-9]+}", w.NewHandler(commandWebhook)).Methods("POST")
	w.MainRouter.Handle("/hooks/{id:[A-Za-z0-9]+}", w.NewHandler(incomingWebhook)).Methods("POST")
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	r.ParseForm()

	var err *model.AppError
	incomingWebhookPayload := &model.IncomingWebhookRequest{}
	contentType := r.Header.Get("Content-Type")
	if strings.Split(contentType, "; ")[0] == "application/x-www-form-urlencoded" {
		payload := strings.NewReader(r.FormValue("payload"))

		incomingWebhookPayload, err = decodePayload(payload)
		if err != nil {
			c.Err = err
			return
		}
	} else if strings.HasPrefix(contentType, "multipart/form-data") {
		r.ParseMultipartForm(0)

		decoder := schema.NewDecoder()
		err := decoder.Decode(incomingWebhookPayload, r.PostForm)

		if err != nil {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.error", nil, err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		incomingWebhookPayload, err = decodePayload(r.Body)
		if err != nil {
			c.Err = err
			return
		}
	}

	if c.App.Config().LogSettings.EnableWebhookDebugging {
		mlog.Debug(fmt.Sprintf("Incoming webhook received. Id=%s Content=%s", id, incomingWebhookPayload.ToJson()))
	}

	err = c.App.HandleIncomingWebhook(id, incomingWebhookPayload)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}

func commandWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	response, err := model.CommandResponseFromHTTPBody(r.Header.Get("Content-Type"), r.Body)
	if err != nil {
		c.Err = model.NewAppError("commandWebhook", "web.command_webhook.parse.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	appErr := c.App.HandleCommandWebhook(id, response)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}

func decodePayload(payload io.Reader) (*model.IncomingWebhookRequest, *model.AppError) {
	incomingWebhookPayload, decodeError := model.IncomingWebhookRequestFromJson(payload)

	if decodeError != nil {
		return nil, decodeError
	}

	return incomingWebhookPayload, nil
}
