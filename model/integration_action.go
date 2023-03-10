// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"reflect"
	"strconv"
	"strings"
)

const (
	PostActionTypeButton                        = "button"
	PostActionTypeSelect                        = "select"
	InteractiveDialogTriggerTimeoutMilliseconds = 3000
)

var PostActionRetainPropKeys = []string{"from_webhook", "override_username", "override_icon_url"}

type DoPostActionRequest struct {
	SelectedOption string `json:"selected_option,omitempty"`
	Cookie         string `json:"cookie,omitempty"`
}

type PostAction struct {
	// A unique Action ID. If not set, generated automatically.
	Id string `json:"id,omitempty"`

	// The type of the interactive element. Currently supported are
	// "select" and "button".
	Type string `json:"type,omitempty"`

	// The text on the button, or in the select placeholder.
	Name string `json:"name,omitempty"`

	// If the action is disabled.
	Disabled bool `json:"disabled,omitempty"`

	// Style defines a text and border style.
	// Supported values are "default", "primary", "success", "good", "warning", "danger"
	// and any hex color.
	Style string `json:"style,omitempty"`

	// DataSource indicates the data source for the select action. If left
	// empty, the select is populated from Options. Other supported values
	// are "users" and "channels".
	DataSource string `json:"data_source,omitempty"`

	// Options contains the values listed in a select dropdown on the post.
	Options []*PostActionOptions `json:"options,omitempty"`

	// DefaultOption contains the option, if any, that will appear as the
	// default selection in a select box. It has no effect when used with
	// other types of actions.
	DefaultOption string `json:"default_option,omitempty"`

	// Defines the interaction with the backend upon a user action.
	// Integration contains Context, which is private plugin data;
	// Integrations are stripped from Posts when they are sent to the
	// client, or are encrypted in a Cookie.
	Integration *PostActionIntegration `json:"integration,omitempty"`
	Cookie      string                 `json:"cookie,omitempty" db:"-"`
}

func (p *PostAction) Equals(input *PostAction) bool {
	if p.Id != input.Id {
		return false
	}

	if p.Type != input.Type {
		return false
	}

	if p.Name != input.Name {
		return false
	}

	if p.DataSource != input.DataSource {
		return false
	}

	if p.DefaultOption != input.DefaultOption {
		return false
	}

	if p.Cookie != input.Cookie {
		return false
	}

	// Compare PostActionOptions
	if len(p.Options) != len(input.Options) {
		return false
	}

	for k := range p.Options {
		if p.Options[k].Text != input.Options[k].Text {
			return false
		}

		if p.Options[k].Value != input.Options[k].Value {
			return false
		}
	}

	// Compare PostActionIntegration

	// If input is nil, then return true if original is also nil.
	// Else return false.
	if input.Integration == nil {
		return p.Integration == nil
	}

	// Both are unequal and not nil.
	if p.Integration.URL != input.Integration.URL {
		return false
	}

	if len(p.Integration.Context) != len(input.Integration.Context) {
		return false
	}

	for key, value := range p.Integration.Context {
		inputValue, ok := input.Integration.Context[key]
		if !ok {
			return false
		}

		switch inputValue.(type) {
		case string, bool, int, float64:
			if value != inputValue {
				return false
			}
		default:
			if !reflect.DeepEqual(value, inputValue) {
				return false
			}
		}
	}

	return true
}

// PostActionCookie is set by the server, serialized and encrypted into
// PostAction.Cookie. The clients should hold on to it, and include it with
// subsequent DoPostAction requests.  This allows the server to access the
// action metadata even when it's not available in the database, for ephemeral
// posts.
type PostActionCookie struct {
	Type        string                 `json:"type,omitempty"`
	PostId      string                 `json:"post_id,omitempty"`
	RootPostId  string                 `json:"root_post_id,omitempty"`
	ChannelId   string                 `json:"channel_id,omitempty"`
	DataSource  string                 `json:"data_source,omitempty"`
	Integration *PostActionIntegration `json:"integration,omitempty"`
	RetainProps map[string]any         `json:"retain_props,omitempty"`
	RemoveProps []string               `json:"remove_props,omitempty"`
}

type PostActionOptions struct {
	Text  string `json:"text"`
	Value string `json:"value"`
}

type PostActionIntegration struct {
	URL     string         `json:"url,omitempty"`
	Context map[string]any `json:"context,omitempty"`
}

type PostActionIntegrationRequest struct {
	UserId      string         `json:"user_id"`
	UserName    string         `json:"user_name"`
	ChannelId   string         `json:"channel_id"`
	ChannelName string         `json:"channel_name"`
	TeamId      string         `json:"team_id"`
	TeamName    string         `json:"team_domain"`
	PostId      string         `json:"post_id"`
	TriggerId   string         `json:"trigger_id"`
	Type        string         `json:"type"`
	DataSource  string         `json:"data_source"`
	Context     map[string]any `json:"context,omitempty"`
}

type PostActionIntegrationResponse struct {
	Update           *Post  `json:"update"`
	EphemeralText    string `json:"ephemeral_text"`
	SkipSlackParsing bool   `json:"skip_slack_parsing"` // Set to `true` to skip the Slack-compatibility handling of Text.
}

type PostActionAPIResponse struct {
	Status    string `json:"status"` // needed to maintain backwards compatibility
	TriggerId string `json:"trigger_id"`
}

type Dialog struct {
	CallbackId       string          `json:"callback_id"`
	Title            string          `json:"title"`
	IntroductionText string          `json:"introduction_text"`
	IconURL          string          `json:"icon_url"`
	Elements         []DialogElement `json:"elements"`
	SubmitLabel      string          `json:"submit_label"`
	NotifyOnCancel   bool            `json:"notify_on_cancel"`
	State            string          `json:"state"`
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
	Type       string         `json:"type"`
	URL        string         `json:"url,omitempty"`
	CallbackId string         `json:"callback_id"`
	State      string         `json:"state"`
	UserId     string         `json:"user_id"`
	ChannelId  string         `json:"channel_id"`
	TeamId     string         `json:"team_id"`
	Submission map[string]any `json:"submission"`
	Cancelled  bool           `json:"cancelled"`
}

type SubmitDialogResponse struct {
	Error  string            `json:"error,omitempty"`
	Errors map[string]string `json:"errors,omitempty"`
}

func GenerateTriggerId(userId string, s crypto.Signer) (string, string, *AppError) {
	clientTriggerId := NewId()
	triggerData := strings.Join([]string{clientTriggerId, userId, strconv.FormatInt(GetMillis(), 10)}, ":") + ":"

	h := crypto.SHA256
	sum := h.New()
	sum.Write([]byte(triggerData))
	signature, err := s.Sign(rand.Reader, sum.Sum(nil), h)
	if err != nil {
		return "", "", NewAppError("GenerateTriggerId", "interactive_message.generate_trigger_id.signing_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	base64Sig := base64.StdEncoding.EncodeToString(signature)

	triggerId := base64.StdEncoding.EncodeToString([]byte(triggerData + base64Sig))
	return clientTriggerId, triggerId, nil
}

func (r *PostActionIntegrationRequest) GenerateTriggerId(s crypto.Signer) (string, string, *AppError) {
	clientTriggerId, triggerId, appErr := GenerateTriggerId(r.UserId, s)
	if appErr != nil {
		return "", "", appErr
	}

	r.TriggerId = triggerId
	return clientTriggerId, triggerId, nil
}

func DecodeAndVerifyTriggerId(triggerId string, s *ecdsa.PrivateKey, InteractiveDialogTriggerTimeout int) (string, string, *AppError) {
	triggerIdBytes, err := base64.StdEncoding.DecodeString(triggerId)
	if err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.base64_decode_failed", nil, "", http.StatusBadRequest).Wrap(err)
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
	if now-timestamp > int64(InteractiveDialogTriggerTimeout) {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.expired", map[string]any{"Seconds": InteractiveDialogTriggerTimeout / 1000}, "", http.StatusBadRequest)
	}

	signature, err := base64.StdEncoding.DecodeString(split[3])
	if err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.base64_decode_failed_signature", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var esig struct {
		R, S *big.Int
	}

	if _, err := asn1.Unmarshal(signature, &esig); err != nil {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.signature_decode_failed", nil, "", http.StatusBadRequest).Wrap(err)
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

func (r *OpenDialogRequest) DecodeAndVerifyTriggerId(s *ecdsa.PrivateKey, InteractiveDialogTriggerTimeout int) (string, string, *AppError) {
	return DecodeAndVerifyTriggerId(r.TriggerId, s, InteractiveDialogTriggerTimeout)
}

func (o *Post) StripActionIntegrations() {
	attachments := o.Attachments()
	if o.GetProp("attachments") != nil {
		o.AddProp("attachments", attachments)
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
			if action != nil && action.Id == id {
				return action
			}
		}
	}
	return nil
}

func (o *Post) GenerateActionIds() {
	if o.GetProp("attachments") != nil {
		o.AddProp("attachments", o.Attachments())
	}
	if attachments, ok := o.GetProp("attachments").([]*SlackAttachment); ok {
		for _, attachment := range attachments {
			for _, action := range attachment.Actions {
				if action != nil && action.Id == "" {
					action.Id = NewId()
				}
			}
		}
	}
}

func AddPostActionCookies(o *Post, secret []byte) *Post {
	p := o.Clone()

	// retainedProps carry over their value from the old post, including no value
	retainProps := map[string]any{}
	removeProps := []string{}
	for _, key := range PostActionRetainPropKeys {
		value, ok := p.GetProps()[key]
		if ok {
			retainProps[key] = value
		} else {
			removeProps = append(removeProps, key)
		}
	}

	attachments := p.Attachments()
	for _, attachment := range attachments {
		for _, action := range attachment.Actions {
			c := &PostActionCookie{
				Type:        action.Type,
				ChannelId:   p.ChannelId,
				DataSource:  action.DataSource,
				Integration: action.Integration,
				RetainProps: retainProps,
				RemoveProps: removeProps,
			}

			c.PostId = p.Id
			if p.RootId == "" {
				c.RootPostId = p.Id
			} else {
				c.RootPostId = p.RootId
			}

			b, _ := json.Marshal(c)
			action.Cookie, _ = encryptPostActionCookie(string(b), secret)
		}
	}

	return p
}

func encryptPostActionCookie(plain string, secret []byte) (string, error) {
	if len(secret) == 0 {
		return plain, nil
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesgcm.NonceSize())
	_, err = io.ReadFull(rand.Reader, nonce)
	if err != nil {
		return "", err
	}

	sealed := aesgcm.Seal(nil, nonce, []byte(plain), nil)

	combined := append(nonce, sealed...)
	encoded := make([]byte, base64.StdEncoding.EncodedLen(len(combined)))
	base64.StdEncoding.Encode(encoded, combined)

	return string(encoded), nil
}

func DecryptPostActionCookie(encoded string, secret []byte) (string, error) {
	if len(secret) == 0 {
		return encoded, nil
	}

	block, err := aes.NewCipher(secret)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(encoded)))
	n, err := base64.StdEncoding.Decode(decoded, []byte(encoded))
	if err != nil {
		return "", err
	}
	decoded = decoded[:n]

	nonceSize := aesgcm.NonceSize()
	if len(decoded) < nonceSize {
		return "", fmt.Errorf("cookie too short")
	}

	nonce, decoded := decoded[:nonceSize], decoded[nonceSize:]
	plain, err := aesgcm.Open(nil, nonce, decoded, nil)
	if err != nil {
		return "", err
	}

	return string(plain), nil
}
