// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"hash"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

const (
	DEFAULT_WEBHOOK_USERNAME = "webhook"
	WHITE_IP_LIST_SIZE       = 5 //upper limit
)

type SignedIncomingHook struct {
	Timestamp     string
	Signature     string
	Algorithm     string
	Payload       *[]byte
	ContentToSign *[]byte
}

type HeaderModel struct {
	HeaderName string
	SplitBy    string
	Index      string
	Prefix     string
}

type IncomingWebhook struct {
	Id                 string          `json:"id"`
	CreateAt           int64           `json:"create_at"`
	UpdateAt           int64           `json:"update_at"`
	DeleteAt           int64           `json:"delete_at"`
	UserId             string          `json:"user_id"`
	ChannelId          string          `json:"channel_id"`
	TeamId             string          `json:"team_id"`
	DisplayName        string          `json:"display_name"`
	Description        string          `json:"description"`
	Username           string          `json:"username"`
	IconURL            string          `json:"icon_url"`
	ChannelLocked      bool            `json:"channel_locked"`
	SecretToken        string          `json:"secret_token"`
	WhiteIpList        StringArray     `json:"white_ip_list"`
	HmacAlgorithm      string          `json:"hmac_algorithm"`
	TimestampModel     StringInterface `json:"ts_format"`
	HmacModel          StringInterface `json:"hmac_format"`
	SignedContentModel StringArray     `json:"payload_format"`
	ContentType        string          `json:"content_type"`
}

type IncomingWebhookRequest struct {
	Text        string             `json:"text"`
	Username    string             `json:"username"`
	IconURL     string             `json:"icon_url"`
	ChannelName string             `json:"channel"`
	Props       StringInterface    `json:"props"`
	Attachments []*SlackAttachment `json:"attachments"`
	Type        string             `json:"type"`
	IconEmoji   string             `json:"icon_emoji"`
}

func (o *IncomingWebhook) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func IncomingWebhookFromJson(data io.Reader) *IncomingWebhook {
	var o *IncomingWebhook
	json.NewDecoder(data).Decode(&o)
	return o
}

func IncomingWebhookListToJson(l []*IncomingWebhook) string {
	b, _ := json.Marshal(l)
	return string(b)
}

func IncomingWebhookListFromJson(data io.Reader) []*IncomingWebhook {
	var o []*IncomingWebhook
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *IncomingWebhook) ResetModels() {
	o.HmacAlgorithm = ""
	o.TimestampModel = StringInterface{}
	o.HmacModel = StringInterface{}
	o.SignedContentModel = StringArray{}
}

func ValidModelSplitter(s *StringInterface) bool {
	// empty splitBy is valid
	splitValue, isSet := s.ValidHeaderModel("SplitBy")
	if !isSet {
		delete(*s, "Index")
		return true
	}

	idxValue, _ := s.ValidHeaderModel("Index")
	if len(splitValue) > 0 {
		if !(len(idxValue) > 0) {
			return false
		}
		intIdx, err := strconv.ParseInt(idxValue, 10, 0)
		if err != nil {
			return false
		} else if int(intIdx) > 5 || int(intIdx) < 0 {
			return false
		}
	} else {
		if len(idxValue) > 0 {
			return false
		}
	}

	return true
}

func (s StringInterface) ValidHeaderModel(mapKey string) (string, bool) {
	_, isSet := s[mapKey]
	if headerPartStr, ok := s[mapKey].(string); ok {
		return headerPartStr, isSet
	}
	return "", isSet
}

func (o *IncomingWebhook) IsValidModels() bool {
	if !(o.HmacAlgorithm == "HMAC-SHA1" || o.HmacAlgorithm == "HMAC-SHA256") {
		return false
	}

	if !(len(o.SignedContentModel) > 0 && len(o.SignedContentModel) < 6) {
		return false
	}

	hmacModelHeader, ok := o.HmacModel["HeaderName"].(string)
	if !(ok && 0 < len(hmacModelHeader) && len(hmacModelHeader) < 26) {
		return false
	}
	if !ValidModelSplitter(&o.HmacModel) {
		return false
	}

	if pre, pSet := o.HmacModel.ValidHeaderModel("Prefix"); pSet && pre == "" {
		return false
	}

	timestampModelH := o.TimestampModel["HeaderName"]
	if timestampModelH == nil {
		o.TimestampModel = StringInterface{}
	} else {
		tsModelHeader, ok1 := timestampModelH.(string)
		if !(ok1 && 0 < len(tsModelHeader) && len(tsModelHeader) < 26) {
			return false

		}

		if !ValidModelSplitter(&o.TimestampModel) {
			return false
		}

		if pre, pSet := o.TimestampModel.ValidHeaderModel("Prefix"); pSet && (pre == "" || len(pre) > 8) {
			return false
		}

	}

	return true
}

func ParseHeaderModel(s StringInterface) HeaderModel {
	headerModel := HeaderModel{}
	for _, modelKey := range [4]string{"HeaderName", "SplitBy", "Index", "Prefix"} {
		if headerPart, ok := s[modelKey].(string); ok {
			switch modelKey {
			case "HeaderName":
				headerModel.HeaderName = headerPart
			case "SplitBy":
				headerModel.SplitBy = headerPart
			case "Index":
				headerModel.Index = headerPart
			case "Prefix":
				headerModel.Prefix = headerPart
			}
		}
	}
	return headerModel
}

func (sp SignedIncomingHook) VerifySignature(secretToken string) bool {
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

func (o *IncomingWebhook) ParseHeader(signedHook *SignedIncomingHook, r *http.Request) *AppError {

	timestampModel := ParseHeaderModel(o.TimestampModel)
	digestModel := ParseHeaderModel(o.HmacModel)

	time_stamp := new(string)
	digest := new(string)
	for k, v := range map[*string]HeaderModel{time_stamp: timestampModel, digest: digestModel} {
		if len(v.HeaderName) > 0 {
			if !(len(r.Header.Get(v.HeaderName)) > 0) {
				return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.insufficient_header.app_error", nil, "Hmac signatue header not set", http.StatusBadRequest)
			}
			*k = r.Header.Get(v.HeaderName)

			if len(v.SplitBy) > 0 {
				indx, _ := strconv.ParseInt(v.Index, 10, 64)
				if len(strings.Split(*k, v.SplitBy))-1 < int(indx) {
					return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.insufficient_header.app_error", nil, "Hmac model is invalid", http.StatusBadRequest)
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
	signedContent.CreateContentToSign(signedHook)

	return nil
}

func (contentModel StringArray) CreateContentToSign(toSign *SignedIncomingHook) {
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

func (o *IncomingWebhook) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.id.app_error", nil, "", http.StatusBadRequest)

	}

	if o.CreateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.UserId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.ChannelId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.TeamId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.team_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.DisplayName) > 64 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.display_name.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Description) > 500 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.description.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.Username) > 64 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.username.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.IconURL) > 1024 {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.icon_url.app_error", nil, "", http.StatusBadRequest)
	}

	if !(len(o.SecretToken) == 26 || len(o.SecretToken) == 0) {
		// if len(o.SecretToken) > 0 { //for testing
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.secret_token.app_error", nil, "", http.StatusBadRequest)
	}
	//json array of at least 2 ip6 cidr or 5 ip4 cidr
	if len(o.WhiteIpList) > WHITE_IP_LIST_SIZE {
		return NewAppError("IncomingWebhook.IsValid", "model.incoming_hook.white_ip_list_too_long.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

func (o *IncomingWebhook) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *IncomingWebhook) PreUpdate() {
	o.UpdateAt = GetMillis()
}

// escapeControlCharsFromPayload escapes control chars (\n, \t) from a byte slice.
// Context:
// JSON strings are not supposed to contain control characters such as \n, \t,
// ... but some incoming webhooks might still send invalid JSON and we want to
// try to handle that. An example invalid JSON string from an incoming webhook
// might look like this (strings for both "text" and "fallback" attributes are
// invalid JSON strings because they contain unescaped newlines and tabs):
//  `{
//    "text": "this is a test
//						 that contains a newline and tabs",
//    "attachments": [
//      {
//        "fallback": "Required plain-text summary of the attachment
//										that contains a newline and tabs",
//        "color": "#36a64f",
//  			...
//        "text": "Optional text that appears within the attachment
//								 that contains a newline and tabs",
//  			...
//        "thumb_url": "http://example.com/path/to/thumb.png"
//      }
//    ]
//  }`
// This function will search for `"key": "value"` pairs, and escape \n, \t
// from the value.
func escapeControlCharsFromPayload(by []byte) []byte {
	// we'll search for `"text": "..."` or `"fallback": "..."`, ...
	keys := "text|fallback|pretext|author_name|title|value"

	// the regexp reads like this:
	// (?s): this flag let . match \n (default is false)
	// "(keys)": we search for the keys defined above
	// \s*:\s*: followed by 0..n spaces/tabs, a colon then 0..n spaces/tabs
	// ": a double-quote
	// (\\"|[^"])*: any number of times the `\"` string or any char but a double-quote
	// ": a double-quote
	r := `(?s)"(` + keys + `)"\s*:\s*"(\\"|[^"])*"`
	re := regexp.MustCompile(r)

	// the function that will escape \n and \t on the regexp matches
	repl := func(b []byte) []byte {
		if bytes.Contains(b, []byte("\n")) {
			b = bytes.Replace(b, []byte("\n"), []byte("\\n"), -1)
		}
		if bytes.Contains(b, []byte("\t")) {
			b = bytes.Replace(b, []byte("\t"), []byte("\\t"), -1)
		}

		return b
	}

	return re.ReplaceAllFunc(by, repl)
}

func decodeIncomingWebhookRequest(by []byte) (*IncomingWebhookRequest, error) {
	decoder := json.NewDecoder(bytes.NewReader(by))
	var o IncomingWebhookRequest
	err := decoder.Decode(&o)
	if err == nil {
		return &o, nil
	} else {
		return nil, err
	}
}

func IncomingWebhookRequestFromJson(data io.Reader) (*IncomingWebhookRequest, *AppError) {
	buf := new(bytes.Buffer)
	buf.ReadFrom(data)
	by := buf.Bytes()

	// Try to decode the JSON data. Only if it fails, try to escape control
	// characters from the strings contained in the JSON data.
	o, err := decodeIncomingWebhookRequest(by)
	if err != nil {
		o, err = decodeIncomingWebhookRequest(escapeControlCharsFromPayload(by))
		if err != nil {
			return nil, NewAppError("IncomingWebhookRequestFromJson", "model.incoming_hook.parse_data.app_error", nil, err.Error(), http.StatusBadRequest)
		}
	}

	o.Attachments = StringifySlackFieldValue(o.Attachments)

	return o, nil
}

func (o *IncomingWebhookRequest) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}
