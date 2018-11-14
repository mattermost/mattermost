// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
)

const (
	POST_ACTION_TYPE_BUTTON                         = "button"
	POST_ACTION_TYPE_SELECT                         = "select"
	INTERACTIVE_DIALOG_TRIGGER_TIMEOUT_MILLISECONDS = 3000
)

type DoPostActionRequest struct {
	SelectedOption string `json:"selected_option"`
}

type PostAction struct {
	Id          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	DataSource  string                 `json:"data_source"`
	Options     []*PostActionOptions   `json:"options"`
	Integration *PostActionIntegration `json:"integration,omitempty"`
}

type PostActionOptions struct {
	Text  string `json:"text"`
	Value string `json:"value"`
}

type PostActionIntegration struct {
	URL     string                 `json:"url,omitempty"`
	Context map[string]interface{} `json:"context,omitempty"`
}

type PostActionIntegrationRequest struct {
	UserId     string                 `json:"user_id"`
	ChannelId  string                 `json:"channel_id"`
	TeamId     string                 `json:"team_id"`
	PostId     string                 `json:"post_id"`
	TriggerId  string                 `json:"trigger_id"`
	Type       string                 `json:"type"`
	DataSource string                 `json:"data_source"`
	Context    map[string]interface{} `json:"context,omitempty"`
}

type PostActionIntegrationResponse struct {
	Update        *Post  `json:"update"`
	EphemeralText string `json:"ephemeral_text"`
}

type PostActionAPIResponse struct {
	Status    string `json:"status"` // needed to maintain backwards compatibility
	TriggerId string `json:"trigger_id"`
}

type Dialog struct {
	CallbackId     string          `json:"callback_id"`
	Title          string          `json:"title"`
	IconURL        string          `json:"icon_url"`
	Elements       []DialogElement `json:"elements"`
	SubmitLabel    string          `json:"submit_label"`
	NotifyOnCancel bool            `json:"notify_on_cancel"`
	State          string          `json:"state"`
}

type DialogElement struct {
	DisplayName string               `json:"display_name"`
	Name        string               `json:"name"`
	Type        string               `json:"type"`
	SubType     string               `json:"subtype"`
	Default     string               `json:"default"`
	Placeholder string               `json:"placeholder"`
	HelpText    string               `json:"help_text"`
	Optional    bool                 `json:"optional"`
	MinLength   int                  `json:"min_length"`
	MaxLength   int                  `json:"max_length"`
	DataSource  string               `json:"data_source"`
	Options     []*PostActionOptions `json:"options"`
}

type OpenDialogRequest struct {
	TriggerId string `json:"trigger_id"`
	URL       string `json:"url"`
	Dialog    Dialog `json:"dialog"`
}

type SubmitDialogRequest struct {
	Type       string                 `json:"type"`
	URL        string                 `json:"url,omitempty"`
	CallbackId string                 `json:"callback_id"`
	State      string                 `json:"state"`
	UserId     string                 `json:"user_id"`
	ChannelId  string                 `json:"channel_id"`
	TeamId     string                 `json:"team_id"`
	Submission map[string]interface{} `json:"submission"`
	Cancelled  bool                   `json:"cancelled"`
}

type SubmitDialogResponse struct {
	Errors map[string]string `json:"errors,omitempty"`
}

func (r *PostActionIntegrationRequest) ToJson() []byte {
	b, _ := json.Marshal(r)
	return b
}

func GenerateTriggerId(userId string, s crypto.Signer) (string, string, *AppError) {
	clientTriggerId := NewId()
	triggerData := strings.Join([]string{clientTriggerId, userId, strconv.FormatInt(GetMillis(), 10)}, ":") + ":"

	h := crypto.SHA256
	sum := h.New()
	sum.Write([]byte(triggerData))
	signature, err := s.Sign(rand.Reader, sum.Sum(nil), h)
	if err != nil {
		return "", "", NewAppError("GenerateTriggerId", "interactive_message.generate_trigger_id.signing_failed", nil, err.Error(), http.StatusInternalServerError)
	}

	base64Sig := base64.StdEncoding.EncodeToString(signature)

	triggerId := base64.StdEncoding.EncodeToString([]byte(triggerData + base64Sig))
	return clientTriggerId, triggerId, nil
}

func (r *PostActionIntegrationRequest) GenerateTriggerId(s crypto.Signer) (string, string, *AppError) {
	clientTriggerId, triggerId, err := GenerateTriggerId(r.UserId, s)
	if err != nil {
		return "", "", err
	}

	r.TriggerId = triggerId
	return clientTriggerId, triggerId, nil
}

func DecodeAndVerifyTriggerId(triggerId string, s *ecdsa.PrivateKey) (string, string, *AppError) {
	triggerIdBytes, err := base64.StdEncoding.DecodeString(triggerId)
	if err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.base64_decode_failed", nil, err.Error(), http.StatusBadRequest)
	}

	split := strings.Split(string(triggerIdBytes), ":")
	if len(split) != 4 {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.missing_data", nil, "", http.StatusBadRequest)
	}

	clientTriggerId := split[0]
	userId := split[1]
	timestampStr := split[2]
	timestamp, _ := strconv.ParseInt(timestampStr, 10, 64)

	now := GetMillis()
	if now-timestamp > INTERACTIVE_DIALOG_TRIGGER_TIMEOUT_MILLISECONDS {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.expired", map[string]interface{}{"Seconds": INTERACTIVE_DIALOG_TRIGGER_TIMEOUT_MILLISECONDS / 1000}, "", http.StatusBadRequest)
	}

	signature, err := base64.StdEncoding.DecodeString(split[3])
	if err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.base64_decode_failed_signature", nil, err.Error(), http.StatusBadRequest)
	}

	var esig struct {
		R, S *big.Int
	}

	if _, err := asn1.Unmarshal([]byte(signature), &esig); err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.signature_decode_failed", nil, err.Error(), http.StatusBadRequest)
	}

	triggerData := strings.Join([]string{clientTriggerId, userId, timestampStr}, ":") + ":"

	h := crypto.SHA256
	sum := h.New()
	sum.Write([]byte(triggerData))

	if !ecdsa.Verify(&s.PublicKey, sum.Sum(nil), esig.R, esig.S) {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.verify_signature_failed", nil, "", http.StatusBadRequest)
	}

	return clientTriggerId, userId, nil
}

func (r *OpenDialogRequest) DecodeAndVerifyTriggerId(s *ecdsa.PrivateKey) (string, string, *AppError) {
	return DecodeAndVerifyTriggerId(r.TriggerId, s)
}

func PostActionIntegrationRequestFromJson(data io.Reader) *PostActionIntegrationRequest {
	var o *PostActionIntegrationRequest
	err := json.NewDecoder(data).Decode(&o)
	if err != nil {
		return nil
	}
	return o
}

func (r *PostActionIntegrationResponse) ToJson() []byte {
	b, _ := json.Marshal(r)
	return b
}

func PostActionIntegrationResponseFromJson(data io.Reader) *PostActionIntegrationResponse {
	var o *PostActionIntegrationResponse
	err := json.NewDecoder(data).Decode(&o)
	if err != nil {
		return nil
	}
	return o
}

func (o *Post) StripActionIntegrations() {
	attachments := o.Attachments()
	if o.Props["attachments"] != nil {
		o.Props["attachments"] = attachments
	}
	for _, attachment := range attachments {
		for _, action := range attachment.Actions {
			action.Integration = nil
		}
	}
}

func (o *Post) GetAction(id string) *PostAction {
	for _, attachment := range o.Attachments() {
		for _, action := range attachment.Actions {
			if action.Id == id {
				return action
			}
		}
	}
	return nil
}

func (o *Post) GenerateActionIds() {
	if o.Props["attachments"] != nil {
		o.Props["attachments"] = o.Attachments()
	}
	if attachments, ok := o.Props["attachments"].([]*SlackAttachment); ok {
		for _, attachment := range attachments {
			for _, action := range attachment.Actions {
				if action.Id == "" {
					action.Id = NewId()
				}
			}
		}
	}
}

func DoPostActionRequestFromJson(data io.Reader) *DoPostActionRequest {
	var o *DoPostActionRequest
	json.NewDecoder(data).Decode(&o)
	return o
}
