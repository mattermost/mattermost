// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (w *Web) InitWebhooks() {
	w.MainRouter.Handle("/hooks/commands/{id:[A-Za-z0-9]+}", w.APIHandlerTrustRequester(commandWebhook)).Methods(http.MethodPost)
	w.MainRouter.Handle("/hooks/{id:[A-Za-z0-9]+}", w.APIHandlerTrustRequester(incomingWebhook)).Methods(http.MethodPost)
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]
	errCtx := map[string]any{"hook_id": id}

	err := r.ParseForm()
	if err != nil {
		c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.parse_form.app_error", errCtx, "", http.StatusBadRequest).Wrap(err)
		return
	}

	var appErr *model.AppError
	var mediaType string
	incomingWebhookPayload := &model.IncomingWebhookRequest{}
	contentType := r.Header.Get("Content-Type")
	// Content-Type header is optional so could be empty
	if contentType != "" {
		var mimeErr error
		mediaType, _, mimeErr = mime.ParseMediaType(contentType)
		if mimeErr != nil && mimeErr != mime.ErrInvalidMediaParameter {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.media_type.app_error", errCtx, "", http.StatusBadRequest).Wrap(mimeErr)
			return
		}
	}

	defer func() {
		if *c.App.Config().LogSettings.EnableWebhookDebugging && c.Err != nil {
			c.Logger.Debug("Incoming webhook received",
				mlog.String("webhook_id", id),
				mlog.String("content_type", contentType),
				mlog.Int("payload_size", r.ContentLength),
				mlog.Err(c.Err),
			)
		}
	}()

	errCtx["media_type"] = mediaType
	if mediaType == "application/x-www-form-urlencoded" {
		payload := strings.NewReader(r.FormValue("payload"))

		incomingWebhookPayload, appErr = decodePayload(payload)
		if appErr != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.decode.app_error", errCtx, "", http.StatusBadRequest).Wrap(appErr)
			return
		}
	} else if mediaType == "multipart/form-data" {
		if err := r.ParseMultipartForm(0); err != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.parse_multipart.app_error", errCtx, "", http.StatusBadRequest).Wrap(err)
			return
		}

		decoder := schema.NewDecoder()
		err := decoder.Decode(incomingWebhookPayload, r.PostForm)

		if err != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.decode.app_error", errCtx, "", http.StatusBadRequest).Wrap(err)
			return
		}
	} else {
		incomingWebhookPayload, appErr = decodePayload(r.Body)
		if appErr != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.decode.app_error", errCtx, "", appErr.StatusCode).Wrap(appErr)
			return
		}
	}

	appErr = c.App.HandleIncomingWebhook(c.AppContext, id, incomingWebhookPayload)
	if appErr != nil {
		c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.general.app_error", errCtx, "", appErr.StatusCode).Wrap(appErr)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	if _, err := w.Write([]byte("ok")); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}
}

func commandWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]
	errCtx := map[string]any{"hook_id": id}

	response, err := model.CommandResponseFromHTTPBody(r.Header.Get("Content-Type"), r.Body)
	if err != nil {
		c.Err = model.NewAppError("commandWebhook", "web.command_webhook.parse.app_error", errCtx, "", http.StatusBadRequest).Wrap(err)
		return
	}

	if response != nil {
		if vErr := response.IsValid(); vErr != nil {
			c.Logger.Warn("Command response is not valid. Please update your integration to be compliant.", mlog.Err(vErr))
		}
	}

	appErr := c.App.HandleCommandWebhook(c.AppContext, id, response)
	if appErr != nil {
		c.Err = model.NewAppError("commandWebhook", "web.command_webhook.general.app_error", errCtx, "", appErr.StatusCode).Wrap(appErr)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	if _, err := w.Write([]byte("ok")); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}
}

func decodePayload(payload io.Reader) (*model.IncomingWebhookRequest, *model.AppError) {
	incomingWebhookPayload, decodeError := model.IncomingWebhookRequestFromJSON(payload)

	if decodeError != nil {
		return nil, decodeError
	}

	return incomingWebhookPayload, nil
}
