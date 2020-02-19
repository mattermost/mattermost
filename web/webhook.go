// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/schema"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	TIMESTAMP_UPPER_LIMIT = 30 //in second
	TIMESTAMP_LOWER_LIMIT = -30
)

type headerModel struct {
	HeaderName string
	SplitBy    string
	Index      string
	Prefix     string
}

type signedIncomingHook struct {
	Timestamp     string
	Signature     string
	Algorithm     string
	Payload       *[]byte
	ContentToSign *[]byte
}

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
	if len(validIncomingHook.SecretToken) > 0 {
		payLoad, err := ioutil.ReadAll(r.Body)
		if err != nil || len(payLoad) == 0 {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.empty_webhook.app_error", nil, "", http.StatusBadRequest)
			return
		}

		if strings.Split(contentType, ";")[0] != validIncomingHook.ContentType {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.invalid_content_type.app_error", nil, "", http.StatusBadRequest)
			return
		}

		signedWebhook := signedIncomingHook{Algorithm: validIncomingHook.HmacAlgorithm, Payload: &payLoad}
		parsingErr := parseHeader(validIncomingHook, &signedWebhook, r)
		if parsingErr != nil {
			c.Err = parsingErr
			return
		}

		if !signedWebhook.verifySignature(validIncomingHook.SecretToken) {
			c.Err = model.NewAppError("incomingWebhook", "api.webhook.incoming.invalid_webhook_Hmac.app_error", nil, "Hmac signature don't match.", http.StatusBadRequest)
			return
		}

		if len(signedWebhook.Timestamp) > 0 {
			if !isValidTimeWindow(signedWebhook.Timestamp) {
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
				mlog.Debug("Incoming webhook received", mlog.String("webhook_id", id), mlog.String("request_id", c.App.RequestId()), mlog.String("payload", incomingWebhookPayload.ToJson()))
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

func parseHeaderModel(s model.StringInterface) headerModel {
	hm := headerModel{}
	for _, modelKey := range [4]string{"HeaderName", "SplitBy", "Index", "Prefix"} {
		if headerPart, ok := s[modelKey].(string); ok {
			switch modelKey {
			case "HeaderName":
				hm.HeaderName = headerPart
			case "SplitBy":
				hm.SplitBy = headerPart
			case "Index":
				hm.Index = headerPart
			case "Prefix":
				hm.Prefix = headerPart
			}
		}
	}
	return hm
}

func parseHeader(o *model.IncomingWebhook, signedHook *signedIncomingHook, r *http.Request) *model.AppError {

	timestampModel := parseHeaderModel(o.TimestampModel)
	digestModel := parseHeaderModel(o.HmacModel)

	time_stamp := new(string)
	digest := new(string)
	for k, v := range map[*string]headerModel{time_stamp: timestampModel, digest: digestModel} {
		if len(v.HeaderName) > 0 {
			if !(len(r.Header.Get(v.HeaderName)) > 0) {
				return model.NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.insufficient_header.app_error", nil, "Hmac signatue header not set", http.StatusBadRequest)
			}
			*k = r.Header.Get(v.HeaderName)

			if len(v.SplitBy) > 0 {
				indx, _ := strconv.ParseInt(v.Index, 10, 64)
				if len(strings.Split(*k, v.SplitBy))-1 < int(indx) {
					return model.NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.insufficient_header.app_error", nil, "Hmac model is invalid", http.StatusBadRequest)
				}
				*k = strings.Split(*k, v.SplitBy)[indx]
			}

			if len(v.Prefix) > 0 {
				oldK := *k
				*k = strings.TrimPrefix(oldK, v.Prefix)
			}
		}
	}
	signedHook.Timestamp = *time_stamp
	signedHook.Signature = *digest

	signedContent := o.SignedContentModel
	createContentToSign(signedContent, signedHook)

	return nil
}

func createContentToSign(contentModel model.StringArray, toSign *signedIncomingHook) {
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
	if len(contentModel) > 0 {
		toSign.ContentToSign = &contentToSign
	}
}

func (sp signedIncomingHook) verifySignature(secretToken string) bool {
	var mac hash.Hash
	if sp.Algorithm == "HMAC-SHA1" {
		mac = hmac.New(sha1.New, []byte(secretToken))
	} else {
		mac = hmac.New(sha256.New, []byte(secretToken))
	}

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
		if timePassed > TIMESTAMP_UPPER_LIMIT {
			return false
		} else {
			return true
		}
	} else {
		if timePassed < TIMESTAMP_LOWER_LIMIT {
			return false
		} else {
			return true
		}
	}
}
