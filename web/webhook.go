// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (w *Web) InitWebhooks() {
	w.MainRouter.Handle("/hooks/commands/{id:[A-Za-z0-9]+}", w.NewHandler(commandWebhook)).Methods("POST")
	w.MainRouter.Handle("/hooks/{id:[A-Za-z0-9]+}", w.NewHandler(incomingWebhook)).Methods("POST")
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var err *model.AppError
	incomingWebhookPayload := &model.IncomingWebhookRequest{}

	if len(id) != 26 {
		c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_hook_id.app_error", nil, "webhookId length don't match", http.StatusBadRequest)
		return
	}
	validIncomingHook, err := c.App.GetIncomingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}
	contentType := r.Header.Get("Content-Type")
	if len(validIncomingHook.WhiteIpList) > 0 {
		if !(model.IsInWhitelist(model.GetRemoteAddress(r.RemoteAddr), validIncomingHook.WhiteIpList)) {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_hook_ip.app_error", nil, "Ip is not found in whitelist", http.StatusBadRequest)
			return
		}
	} else if len(validIncomingHook.SecretToken) > 0 {
		payLoad, err := ioutil.ReadAll(r.Body)
		if err != nil || len(payLoad) == 0 {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.empty_webhook.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if strings.Split(contentType, ";")[0] != validIncomingHook.ContentType {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.invalid_content_type.app_error", nil, "", http.StatusBadRequest)
			return
		}

		signedWebhook := model.SignedIncomingHook{Algorithm: validIncomingHook.HmacAlgorithm, Payload: &payLoad}
		parsingErr := validIncomingHook.ParseHeader(&signedWebhook, r)
		if parsingErr != nil {
			c.Err = parsingErr
			return
		}

		if !signedWebhook.VerifySignature(validIncomingHook.SecretToken) {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_webhook_Hmac.app_error", nil, "Hmac signature don't match.", http.StatusBadRequest)
			return
		}

		if len(signedWebhook.Timestamp) > 0 {
			if !model.IsValidTimeWindow(signedWebhook.Timestamp) {
				c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.webhook_expired.app_error", nil, "Webhook is expired or timestamp is malformed.", http.StatusBadRequest)
				return
			}
		}
		r.Body = ioutil.NopCloser(bytes.NewBuffer(payLoad))
	}
	r.ParseForm()

	defer func() {
		if *c.App.Config().LogSettings.EnableWebhookDebugging {
			if c.Err != nil {
				mlog.Debug("Incoming webhook received", mlog.String("webhook_id", id), mlog.String("request_id", c.App.RequestId), mlog.String("payload", incomingWebhookPayload.ToJson()))
			}
		}
	}()

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
