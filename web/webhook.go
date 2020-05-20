// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/ioutil"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

type headerModel struct {
	SignatureHeader string
	TimestampHeader string
	Prefix          string
}

type signedIncomingHook struct {
	Timestamp     string
	Signature     string
	Payload       *[]byte
	ContentToSign *[]byte
}

const (
	webhookSigningTimestampDeltaUpperLimit = 30 //in second
	webhookSigningTimestampDeltaLowerLimit = -30
	supportedWebhookContentType            = "application/json"
	supportedHookDigestPrefix              = "v0="
)

var (
	mattermostSignedWebhookModel = headerModel{SignatureHeader: "X-Mattermost-Signature",
		TimestampHeader: "X-Mattermost-Request-Timestamp"}
	slackSignedWebhookModel = headerModel{SignatureHeader: "X-Slack-Signature",
		TimestampHeader: "X-Slack-Request-Timestamp"}
	signedContentModel = [4]string{"v0:", "{timestamp}", ":", "{payload}"}
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

	if len(id) != 26 {
		c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_hook_id.app_error", nil, "webhookId length don't match", http.StatusBadRequest)
		return
	}

	validIncomingHook, err := c.App.GetIncomingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	mediaType, _, mimeErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mimeErr != nil && mimeErr != mime.ErrInvalidMediaParameter {
		c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.error", nil, mimeErr.Error(), http.StatusBadRequest)
		return
	}

	if validIncomingHook.SignatureExpected {
		payLoad, err := ioutil.ReadAll(r.Body)
		if err != nil || len(payLoad) == 0 {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.empty_webhook.app_error", nil, "", http.StatusBadRequest)
			return
		}
		// supporting json only
		if mediaType != supportedWebhookContentType {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.invalid_content_type.app_error", nil, "", http.StatusBadRequest)
			return
		}

		signedWebhook := signedIncomingHook{Payload: &payLoad}
		parsingErr := parseHeader(&signedWebhook, r)
		if parsingErr != nil {
			c.Err = parsingErr
			return
		}

		if !signedWebhook.verifySignature(validIncomingHook.SecretToken) {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_webhook_Hmac.app_error", nil, "Hmac signature don't match.", http.StatusBadRequest)
			return
		}

		if !isValidTimeWindow(signedWebhook.Timestamp) {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.webhook_expired.app_error", nil, "Webhook is expired or timestamp is malformed.", http.StatusBadRequest)
			return
		}

		r.Body = ioutil.NopCloser(bytes.NewBuffer(payLoad))
	}

	defer func() {
		if *c.App.Config().LogSettings.EnableWebhookDebugging {
			if c.Err != nil {
				mlog.Debug("Incoming webhook received", mlog.String("webhook_id", id), mlog.String("request_id", c.App.RequestId()), mlog.String("payload", incomingWebhookPayload.ToJson()))
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

func getValidSignature(digestWithPrefix, timestampReceived string) (string, *model.AppError) {
	digestWithoutPrefix := strings.TrimPrefix(digestWithPrefix, supportedHookDigestPrefix)

	if !(len(digestWithPrefix) > len(digestWithoutPrefix)) {
		return "", model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_signature.app_error", nil, "Signature is invalid", http.StatusBadRequest)
	}

	if !(len(timestampReceived) > 0) {
		return "", model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_timestamp.app_error", nil, "Timestamp is invalid", http.StatusBadRequest)
	}

	return digestWithoutPrefix, nil
}

func parseHeader(signedHook *signedIncomingHook, r *http.Request) *model.AppError {
	isSupportedSignature := false
	// check if supported signature is used
	for _, supportedModel := range [2]headerModel{mattermostSignedWebhookModel, slackSignedWebhookModel} {
		if signature := r.Header.Get(supportedModel.SignatureHeader); len(signature) > 0 {
			timestamp := r.Header.Get(supportedModel.TimestampHeader)

			digest, err := getValidSignature(signature, timestamp)
			if err != nil {
				return err
			}
			signedHook.Signature = digest
			signedHook.Timestamp = timestamp

			isSupportedSignature = true
			break
		}
	}

	if !isSupportedSignature {
		return model.NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.insufficient_header.app_error", nil, "Not a supported signature", http.StatusBadRequest)
	}

	createContentToSign(signedContentModel, signedHook)

	return nil
}

func createContentToSign(contentModel [4]string, toSign *signedIncomingHook) {
	var contentToSign []byte
	for _, signedPart := range contentModel {
		switch signedPart {
		case "{timestamp}":
			contentToSign = append(contentToSign, []byte(toSign.Timestamp)...)
		case "{payload}":
			contentToSign = append(contentToSign, *toSign.Payload...)
		default:
			contentToSign = append(contentToSign, []byte(signedPart)...)
		}
	}

	toSign.ContentToSign = &contentToSign
}

func (sp signedIncomingHook) verifySignature(secretToken string) bool {
	// supporting sha256 schema only
	mac := hmac.New(sha256.New, []byte(secretToken))

	mac.Write(*sp.ContentToSign)
	sha := mac.Sum(nil)

	sig, err := hex.DecodeString(sp.Signature)
	if err != nil {
		return false
	}

	return hmac.Equal(sig, sha)
}

func isValidTimeWindow(signedTime string) bool {
	stampInt, err := strconv.ParseInt(signedTime, 10, 64)
	if err != nil {
		return false
	}

	timePassed := time.Now().Unix() - stampInt
	if timePassed > 0 {
		if timePassed > webhookSigningTimestampDeltaUpperLimit {
			return false
		}
		return true
	}
	if timePassed < webhookSigningTimestampDeltaLowerLimit {
		return false
	}
	return true
}
