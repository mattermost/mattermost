// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func (w *Web) InitWebhooks() {
	w.MainRouter.Handle("/hooks/commands/{id:[A-Za-z0-9]+}", w.APIHandlerTrustRequester(commandWebhook)).Methods("POST")
	w.MainRouter.Handle("/hooks/{id:[A-Za-z0-9]+}", w.APIHandlerTrustRequester(incomingWebhook)).Methods("POST")
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	r.ParseForm()

	var err *model.AppError
	var mediaType string
	incomingWebhookPayload := &model.IncomingWebhookRequest{}
	contentType := r.Header.Get("Content-Type")
	// Content-Type header is optional so could be empty
	if contentType != "" {
		var mimeErr error
		mediaType, _, mimeErr = mime.ParseMediaType(contentType)
		if mimeErr != nil && mimeErr != mime.ErrInvalidMediaParameter {
			c.Err = model.NewAppError("incomingWebhook",
				"api.webhook.incoming.error",
				nil,
				"webhook_id="+id+", error: "+mimeErr.Error(),
				http.StatusBadRequest,
			)
			return
		}
	}

	defer func() {
		if *c.App.Config().LogSettings.EnableWebhookDebugging {
			if c.Err != nil {
				fields := []mlog.Field{mlog.String("webhook_id", id), mlog.String("request_id", c.AppContext.RequestId())}
				payload, err := json.Marshal(incomingWebhookPayload)
				if err != nil {
					fields = append(fields, mlog.NamedErr("encoding_err", err))
				} else {
					fields = append(fields, mlog.String("payload", string(payload)))
				}

				mlog.Debug("Incoming webhook received", fields...)
			}
		}
	}()

	if mediaType == "application/x-www-form-urlencoded" {
		payload := strings.NewReader(r.FormValue("payload"))

		incomingWebhookPayload, err = decodePayload(payload)
		if err != nil {
			c.Err = err
			return
		}
	} else if mediaType == "multipart/form-data" {
		r.ParseMultipartForm(0)

		decoder := schema.NewDecoder()
		err := decoder.Decode(incomingWebhookPayload, r.PostForm)

		if err != nil {
			c.Err = model.NewAppError("incomingWebhook",
				"api.webhook.incoming.error",
				nil,
				"webhook_id="+id+", error: "+err.Error(),
				http.StatusBadRequest,
			)
			return
		}
	} else {
		incomingWebhookPayload, err = decodePayload(r.Body)
		if err != nil {
			c.Err = err
			return
		}
	}

	err = c.App.HandleIncomingWebhook(c.AppContext, id, incomingWebhookPayload)
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
		c.Err = model.NewAppError("commandWebhook", "web.command_webhook.parse.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	appErr := c.App.HandleCommandWebhook(c.AppContext, id, response)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}

func decodePayload(payload io.Reader) (*model.IncomingWebhookRequest, *model.AppError) {
	incomingWebhookPayload, decodeError := model.IncomingWebhookRequestFromJSON(payload)

	if decodeError != nil {
		return nil, decodeError
	}

	return incomingWebhookPayload, nil
}
