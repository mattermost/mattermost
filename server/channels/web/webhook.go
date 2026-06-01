// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"sort"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/webhook_template"
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
		if *c.App.Config().LogSettings.EnableWebhookDebugging {
			if c.Err != nil {
				fields := []mlog.Field{mlog.String("webhook_id", id), mlog.String("request_id", c.AppContext.RequestId())}
				payload, err := json.Marshal(incomingWebhookPayload)
				if err != nil {
					fields = append(fields, mlog.NamedErr("encoding_err", err))
				} else {
					fields = append(fields, mlog.String("payload", payload))
				}

				mlog.Debug("Incoming webhook received", fields...)
			}
		}
	}()

	errCtx["media_type"] = mediaType

	// rawJSONBody captures the JSON request body when the JSON branch runs,
	// so the templating overlay can re-parse it as map[string]any without
	// re-reading r.Body (which has already been consumed).
	var rawJSONBody []byte

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
		// Buffer the JSON body so we can feed it to both the typed
		// decoder and the templating overlay without re-reading.
		buf, readErr := io.ReadAll(io.LimitReader(r.Body, webhook_template.MaxBodyBytes+1))
		if readErr != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.decode.app_error", errCtx, "", http.StatusBadRequest).Wrap(readErr)
			return
		}
		rawJSONBody = buf
		incomingWebhookPayload, appErr = decodePayload(bytes.NewReader(rawJSONBody))
		if appErr != nil {
			c.Err = model.NewAppError("incomingWebhook", "web.incoming_webhook.decode.app_error", errCtx, "", appErr.StatusCode).Wrap(appErr)
			return
		}
	}

	// Apply inline templating overlay if all gates are satisfied. This runs
	// after the typed parse so that today's behaviour is fully preserved
	// when no templating params are present (or the feature flag is off).
	if c.App.Config().FeatureFlags.IncomingWebhookTemplates {
		q := r.URL.Query()
		if webhook_template.IsGateTruthy(q) {
			if mediaType != "" && mediaType != "application/json" {
				c.Err = model.NewAppError(
					"incomingWebhook",
					"web.incoming_webhook.template.bad_content_type.app_error",
					errCtx, "", http.StatusBadRequest,
				)
				return
			}
			auditRec := c.MakeAuditRecord(model.AuditEventIncomingHookTemplated, model.AuditStatusFail)
			auditRec.AddMeta("webhook_id", id)
			auditRec.AddMeta("templated_fields", templatedFieldNames(q))
			defer c.LogAuditRec(auditRec)

			if tplErr := webhook_template.Apply(c.AppContext.Context(), rawJSONBody, q, incomingWebhookPayload); tplErr != nil {
				c.Err = templateErrorToAppError(errCtx, tplErr)
				return
			}
			auditRec.Success()
		} else if hasTemplateParams(r.URL.Query()) {
			c.Logger.Debug("incoming webhook templating params present but gate not set; ignoring",
				mlog.String("webhook_id", id))
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

// hasTemplateParams reports whether the query string carries any template-
// shaped key besides the gate itself, so we can debug-log when a caller has
// set templates but forgot the gate.
func hasTemplateParams(q map[string][]string) bool {
	for k := range q {
		switch k {
		case "template", "tmpl":
			continue
		case "text", "username", "icon_url", "icon_emoji", "channel", "priority":
			return true
		}
		if strings.HasPrefix(k, "attachments[") {
			return true
		}
	}
	return false
}

// templatedFieldNames returns the sorted list of templated field names from
// the request's query parameters. The list contains field names only —
// rendered values are never included — so it is safe to attach to an audit
// record without exposing payload data.
func templatedFieldNames(q map[string][]string) []string {
	names := make([]string, 0, len(q))
	for k := range q {
		switch k {
		case "template", "tmpl":
			continue
		case "text", "username", "icon_url", "icon_emoji", "channel", "priority":
			names = append(names, k)
		default:
			if strings.HasPrefix(k, "attachments[") {
				names = append(names, k)
			}
		}
	}
	sort.Strings(names)
	return names
}

// templateErrorToAppError maps a webhook_template sentinel into a stable
// *model.AppError with the appropriate i18n key. DetailedError carries the
// underlying error message so operators can diagnose without exposing the
// rendered payload.
func templateErrorToAppError(errCtx map[string]any, err error) *model.AppError {
	switch {
	case errors.Is(err, webhook_template.ErrDisallowedDirective):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.disallowed.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrParse):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.parse.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrTimeout):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.timeout.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrOutputTooLarge):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.too_large.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrInvalidJSONBody):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.invalid_json_body.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrShortInvalid):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.short_invalid.app_error", errCtx, err.Error(), http.StatusBadRequest)
	case errors.Is(err, webhook_template.ErrIndexOutOfRange):
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.index_out_of_range.app_error", errCtx, err.Error(), http.StatusBadRequest)
	default:
		return model.NewAppError("incomingWebhook", "web.incoming_webhook.template.execute.app_error", errCtx, err.Error(), http.StatusBadRequest)
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
