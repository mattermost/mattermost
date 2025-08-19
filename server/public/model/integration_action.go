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
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
)

const (
	PostActionTypeButton              = "button"
	PostActionTypeSelect              = "select"
	DialogTitleMaxLength              = 24
	DialogElementDisplayNameMaxLength = 24
	DialogElementNameMaxLength        = 300
	DialogElementHelpTextMaxLength    = 150
	DialogElementTextMaxLength        = 150
	DialogElementTextareaMaxLength    = 3000
	DialogElementSelectMaxLength      = 3000
	DialogElementBoolMaxLength        = 150
	DefaultTimeIntervalMinutes        = 60 // Default time interval for DateTime fields
)

var PostActionRetainPropKeys = []string{PostPropsFromWebhook, PostPropsOverrideUsername, PostPropsOverrideIconURL}

type DoPostActionRequest struct {
	SelectedOption string `json:"selected_option,omitempty"`
	Cookie         string `json:"cookie,omitempty"`
}

const (
	PostActionDataSourceUsers    = "users"
	PostActionDataSourceChannels = "channels"
)

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

// IsValid validates the action and returns an error if it is invalid.
func (p *PostAction) IsValid() error {
	var multiErr *multierror.Error

	if p.Name == "" {
		multiErr = multierror.Append(multiErr, fmt.Errorf("action must have a name"))
	}

	if p.Style != "" {
		validStyles := []string{"default", "primary", "success", "good", "warning", "danger"}
		// If not a predefined style, check if it's a hex color
		if !slices.Contains(validStyles, p.Style) && !hexColorRegex.MatchString(p.Style) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("invalid style '%s' - must be one of [default, primary, success, good, warning, danger] or a hex color", p.Style))
		}
	}

	switch p.Type {
	case PostActionTypeButton:
		if len(p.Options) > 0 {
			multiErr = multierror.Append(multiErr, fmt.Errorf("button action must not have options"))
		}
		if p.DataSource != "" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("button action must not have a data source"))
		}
	case PostActionTypeSelect:
		if p.DataSource != "" {
			validSources := []string{PostActionDataSourceUsers, PostActionDataSourceChannels}
			if !slices.Contains(validSources, p.DataSource) {
				multiErr = multierror.Append(multiErr, fmt.Errorf("invalid data_source '%s' for select action", p.DataSource))
			}

			if len(p.Options) > 0 {
				multiErr = multierror.Append(multiErr, fmt.Errorf("select action cannot have both DataSource and Options set"))
			}
		} else {
			if len(p.Options) == 0 {
				multiErr = multierror.Append(multiErr, fmt.Errorf("select action must have either DataSource or Options set"))
			} else {
				for i, opt := range p.Options {
					if opt == nil {
						multiErr = multierror.Append(multiErr, fmt.Errorf("select action contains nil option"))
						continue
					}
					if err := opt.IsValid(); err != nil {
						multiErr = multierror.Append(multiErr, multierror.Prefix(err, fmt.Sprintf("option at index %d is invalid:", i)))
					}
				}
			}
		}
	default:
		multiErr = multierror.Append(multiErr, fmt.Errorf("invalid action type: must be '%s' or '%s'", PostActionTypeButton, PostActionTypeSelect))
	}

	if p.Integration == nil {
		multiErr = multierror.Append(multiErr, fmt.Errorf("action must have integration settings"))
	} else {
		if p.Integration.URL == "" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("action must have an integration URL"))
		}
		if !(strings.HasPrefix(p.Integration.URL, "/plugins/") || strings.HasPrefix(p.Integration.URL, "plugins/") || IsValidHTTPURL(p.Integration.URL)) {
			multiErr = multierror.Append(multiErr, fmt.Errorf("action must have an valid integration URL"))
		}
	}

	return multiErr.ErrorOrNil()
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

	// At this point, input is not nil, so return false if original is.
	if p.Integration == nil {
		return false
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

func (o *PostActionOptions) IsValid() error {
	var multiErr *multierror.Error

	if o.Text == "" {
		multiErr = multierror.Append(multiErr, fmt.Errorf("text is required"))
	}
	if o.Value == "" {
		multiErr = multierror.Append(multiErr, fmt.Errorf("value is required"))
	}

	return multiErr.ErrorOrNil()
}

type PostActionIntegration struct {
	// URL is the endpoint that the action will be sent to.
	// It can be a relative path to a plugin.
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
	MultiSelect bool                 `json:"multiselect"`
	// Date/datetime field specific properties
	MinDate      string `json:"min_date,omitempty"`
	MaxDate      string `json:"max_date,omitempty"`
	TimeInterval int    `json:"time_interval,omitempty"`
	DefaultTime  string `json:"default_time,omitempty"`
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

func DecodeAndVerifyTriggerId(triggerId string, s *ecdsa.PrivateKey, timeout time.Duration) (string, string, *AppError) {
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

	if time.Since(time.UnixMilli(timestamp)) > timeout {
		return "", "", NewAppError("DecodeAndVerifyTriggerId", "interactive_message.decode_trigger_id.expired", map[string]any{"Duration": timeout.String()}, "", http.StatusBadRequest)
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

func (r *OpenDialogRequest) DecodeAndVerifyTriggerId(s *ecdsa.PrivateKey, timeout time.Duration) (string, string, *AppError) {
	return DecodeAndVerifyTriggerId(r.TriggerId, s, timeout)
}

func (r *OpenDialogRequest) IsValid() error {
	var multiErr *multierror.Error
	if r.URL == "" {
		multiErr = multierror.Append(multiErr, errors.New("empty URL"))
	}

	if r.TriggerId == "" {
		multiErr = multierror.Append(multiErr, errors.New("empty trigger id"))
	}

	err := r.Dialog.IsValid()
	if err != nil {
		multiErr = multierror.Append(multiErr, err)
	}

	return multiErr.ErrorOrNil()
}

func (d *Dialog) IsValid() error {
	var multiErr *multierror.Error

	if d.Title == "" || len(d.Title) > DialogTitleMaxLength {
		multiErr = multierror.Append(multiErr, errors.Errorf("invalid dialog title %q", d.Title))
	}

	if d.IconURL != "" && !IsValidHTTPURL(d.IconURL) {
		multiErr = multierror.Append(multiErr, errors.New("invalid icon url"))
	}

	if len(d.Elements) != 0 {
		elementMap := make(map[string]bool)

		for _, element := range d.Elements {
			if elementMap[element.Name] {
				multiErr = multierror.Append(multiErr, errors.Errorf("duplicate dialog element %q", element.Name))
			}
			elementMap[element.Name] = true

			err := element.IsValid()
			if err != nil {
				multiErr = multierror.Append(multiErr, errors.Wrapf(err, "%q field is not valid", element.Name))
			}
		}
	}
	return multiErr.ErrorOrNil()
}

func (e *DialogElement) IsValid() error {
	var multiErr *multierror.Error
	textSubTypes := map[string]bool{
		"":         true,
		"text":     true,
		"email":    true,
		"number":   true,
		"tel":      true,
		"url":      true,
		"password": true,
	}

	if e.MinLength < 0 {
		multiErr = multierror.Append(multiErr, errors.Errorf("min length cannot be a negative number, got %d", e.MinLength))
	}
	if e.MinLength > e.MaxLength {
		multiErr = multierror.Append(multiErr, errors.Errorf("min length should be less then max length, got %d > %d", e.MinLength, e.MaxLength))
	}

	multiErr = multierror.Append(multiErr, checkMaxLength("DisplayName", e.DisplayName, DialogElementDisplayNameMaxLength))
	multiErr = multierror.Append(multiErr, checkMaxLength("Name", e.Name, DialogElementNameMaxLength))
	multiErr = multierror.Append(multiErr, checkMaxLength("HelpText", e.HelpText, DialogElementHelpTextMaxLength))

	if e.MultiSelect && e.Type != "select" {
		multiErr = multierror.Append(multiErr, errors.Errorf("multiselect can only be used with select elements, got type %q", e.Type))
	}

	switch e.Type {
	case "text":
		multiErr = multierror.Append(multiErr, checkMaxLength("Default", e.Default, DialogElementTextMaxLength))
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementTextMaxLength))
		if _, ok := textSubTypes[e.SubType]; !ok {
			multiErr = multierror.Append(multiErr, errors.Errorf("invalid subtype %q", e.Type))
		}

	case "textarea":
		multiErr = multierror.Append(multiErr, checkMaxLength("Default", e.Default, DialogElementTextareaMaxLength))
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementTextareaMaxLength))

		if _, ok := textSubTypes[e.SubType]; !ok {
			multiErr = multierror.Append(multiErr, errors.Errorf("invalid subtype %q", e.Type))
		}

	case "select":
		multiErr = multierror.Append(multiErr, checkMaxLength("Default", e.Default, DialogElementSelectMaxLength))
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementSelectMaxLength))
		if e.DataSource != "" && e.DataSource != "users" && e.DataSource != "channels" {
			multiErr = multierror.Append(multiErr, errors.Errorf("invalid data source %q, allowed are 'users' or 'channels'", e.DataSource))
		}
		if e.DataSource == "" {
			if e.MultiSelect {
				if !isMultiSelectDefaultInOptions(e.Default, e.Options) {
					multiErr = multierror.Append(multiErr, errors.Errorf("multiselect default value %q contains values not in options", e.Default))
				}
			} else if !isDefaultInOptions(e.Default, e.Options) {
				multiErr = multierror.Append(multiErr, errors.Errorf("default value %q doesn't exist in options ", e.Default))
			}
		}

	case "bool":
		if e.Default != "" && e.Default != "true" && e.Default != "false" {
			multiErr = multierror.Append(multiErr, errors.New("invalid default of bool"))
		}
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementBoolMaxLength))

	case "radio":
		if !isDefaultInOptions(e.Default, e.Options) {
			multiErr = multierror.Append(multiErr, errors.Errorf("default value %q doesn't exist in options ", e.Default))
		}

	case "date":
		multiErr = multierror.Append(multiErr, checkMaxLength("Default", e.Default, DialogElementTextMaxLength))
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementTextMaxLength))
		multiErr = multierror.Append(multiErr, validateDateFormat(e.Default))
		multiErr = multierror.Append(multiErr, validateDateFormat(e.MinDate))
		multiErr = multierror.Append(multiErr, validateDateFormat(e.MaxDate))

	case "datetime":
		multiErr = multierror.Append(multiErr, checkMaxLength("Default", e.Default, DialogElementTextMaxLength))
		multiErr = multierror.Append(multiErr, checkMaxLength("Placeholder", e.Placeholder, DialogElementTextMaxLength))
		multiErr = multierror.Append(multiErr, validateDateTimeFormat(e.Default))
		multiErr = multierror.Append(multiErr, validateDateFormat(e.MinDate))
		multiErr = multierror.Append(multiErr, validateDateFormat(e.MaxDate))
		// Validate time_interval for datetime fields
		timeInterval := e.TimeInterval
		if timeInterval == 0 {
			timeInterval = DefaultTimeIntervalMinutes
		}
		if timeInterval < 1 || timeInterval > 1440 {
			multiErr = multierror.Append(multiErr, errors.Errorf("time_interval must be between 1 and 1440 minutes, got %d", timeInterval))
		} else if 1440%timeInterval != 0 {
			multiErr = multierror.Append(multiErr, errors.Errorf("time_interval must be a divisor of 1440 (24 hours * 60 minutes) to create valid time intervals, got %d", timeInterval))
		}
		// Validate default_time format and compatibility with time_interval
		multiErr = multierror.Append(multiErr, validateTimeFormat(e.DefaultTime))
		if e.DefaultTime != "" {
			multiErr = multierror.Append(multiErr, validateDefaultTimeWithInterval(e.DefaultTime, timeInterval))
		}

	default:
		multiErr = multierror.Append(multiErr, errors.Errorf("invalid element type: %q", e.Type))
	}

	return multiErr.ErrorOrNil()
}

func isDefaultInOptions(defaultValue string, options []*PostActionOptions) bool {
	if defaultValue == "" {
		return true
	}

	for _, option := range options {
		if option != nil && defaultValue == option.Value {
			return true
		}
	}

	return false
}

func isMultiSelectDefaultInOptions(defaultValue string, options []*PostActionOptions) bool {
	if defaultValue == "" {
		return true
	}

	for value := range strings.SplitSeq(strings.ReplaceAll(defaultValue, " ", ""), ",") {
		if value == "" {
			continue
		}
		found := false
		for _, option := range options {
			if option != nil && value == option.Value {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

// validateDateFormat validates that a date string is in ISO format (YYYY-MM-DD)
// or a supported relative format (today, tomorrow, yesterday, +1d, etc.)
func validateDateFormat(dateStr string) error {
	if dateStr == "" {
		return nil // Empty default is allowed
	}

	// Check for relative date formats first
	relativeFormats := []string{"today", "tomorrow", "yesterday"}
	for _, format := range relativeFormats {
		if dateStr == format {
			return nil
		}
	}

	// Check for dynamic relative patterns (+1d, +7d, +1w, +1M, etc.)
	if len(dateStr) >= 3 && (dateStr[0] == '+' || dateStr[0] == '-') {
		// Match pattern like "+5d", "+2w", "+1M"
		if len(dateStr) <= 5 { // Reasonable length limit
			lastChar := dateStr[len(dateStr)-1]
			if lastChar == 'd' || lastChar == 'w' || lastChar == 'M' {
				// Validate the number part
				numberPart := dateStr[1 : len(dateStr)-1]
				if _, err := strconv.Atoi(numberPart); err == nil {
					return nil
				}
			}
		}
	}

	// Check for ISO date format (YYYY-MM-DD)
	if _, err := time.Parse("2006-01-02", dateStr); err == nil {
		return nil
	}

	// Also accept datetime formats and extract date portion
	datetimeFormats := []string{
		"2006-01-02T15:04:05Z",          // RFC3339 UTC
		"2006-01-02T15:04:05.000Z",      // RFC3339 with milliseconds UTC
		"2006-01-02T15:04:05-07:00",     // RFC3339 with timezone
		"2006-01-02T15:04:05.000-07:00", // RFC3339 with milliseconds and timezone
		"2006-01-02T15:04:05",           // ISO datetime without timezone
		"2006-01-02T15:04",              // ISO datetime without seconds
	}

	for _, format := range datetimeFormats {
		if parsedTime, err := time.Parse(format, dateStr); err == nil {
			// Validate that the date portion is valid
			dateOnly := parsedTime.Format("2006-01-02")
			if _, err := time.Parse("2006-01-02", dateOnly); err == nil {
				return nil // Valid datetime format, date portion is valid
			}
		}
	}

	return fmt.Errorf("invalid date format: %q, expected ISO format (YYYY-MM-DD), datetime format, or relative format", dateStr)
}

// validateDateTimeFormat validates that a datetime string is in ISO format with timezone
// (YYYY-MM-DDTHH:MM:SSZ) or a supported relative format (+1h, +2H, etc.)
func validateDateTimeFormat(dateTimeStr string) error {
	if dateTimeStr == "" {
		return nil // Empty default is allowed
	}

	// Check for relative time formats (+1h, +2h, +1H, etc.)
	if len(dateTimeStr) >= 3 && (dateTimeStr[0] == '+' || dateTimeStr[0] == '-') {
		if len(dateTimeStr) <= 5 { // Reasonable length limit
			lastChar := strings.ToLower(dateTimeStr[len(dateTimeStr)-1:])
			if lastChar == "h" {
				// Validate the number part
				numberPart := dateTimeStr[1 : len(dateTimeStr)-1]
				if _, err := strconv.Atoi(numberPart); err == nil {
					return nil
				}
			}
		}
	}

	// Try various ISO datetime formats
	formats := []string{
		"2006-01-02T15:04:05Z",          // RFC3339 UTC
		"2006-01-02T15:04:05.000Z",      // RFC3339 with milliseconds UTC
		"2006-01-02T15:04:05-07:00",     // RFC3339 with timezone
		"2006-01-02T15:04:05.000-07:00", // RFC3339 with milliseconds and timezone
	}

	for _, format := range formats {
		if _, err := time.Parse(format, dateTimeStr); err == nil {
			return nil
		}
	}

	return fmt.Errorf("invalid datetime format: %q, expected ISO format (YYYY-MM-DDTHH:MM:SSZ) or relative format", dateTimeStr)
}

// validateTimeFormat validates that a time string is in HH:MM format (24-hour)
func validateTimeFormat(timeStr string) error {
	if timeStr == "" {
		return nil // Empty default_time is allowed
	}

	// Check for HH:MM format (24-hour time)
	if _, err := time.Parse("15:04", timeStr); err != nil {
		return fmt.Errorf("invalid time format: %q, expected HH:MM format (24-hour)", timeStr)
	}

	return nil
}

// validateDefaultTimeWithInterval validates that default_time aligns with time_interval
func validateDefaultTimeWithInterval(defaultTime string, timeInterval int) error {
	if defaultTime == "" {
		return nil // Nothing to validate
	}

	// Use default interval if zero
	interval := timeInterval
	if interval == 0 {
		interval = DefaultTimeIntervalMinutes
	}

	// Parse the default time (format already validated by validateTimeFormat)
	parsedTime, err := time.Parse("15:04", defaultTime)
	if err != nil {
		// This shouldn't happen since validateTimeFormat is called first, but handle gracefully
		return nil
	}

	// Convert to total minutes from midnight
	totalMinutes := parsedTime.Hour()*60 + parsedTime.Minute()

	// Check if the time aligns with the interval
	if totalMinutes%interval != 0 {
		return fmt.Errorf("default_time %q does not align with time_interval %d minutes - time must be a multiple of the interval", defaultTime, interval)
	}

	return nil
}

func checkMaxLength(fieldName string, field string, maxLength int) error {
	// DisplayName and Name are required fields
	if fieldName == "DisplayName" || fieldName == "Name" {
		if len(field) == 0 {
			return errors.Errorf("%v cannot be empty", fieldName)
		}
	}

	if len(field) > maxLength {
		return errors.Errorf("%v cannot be longer than %d characters, got %d", fieldName, maxLength, len(field))
	}

	return nil
}

func (o *Post) StripActionIntegrations() {
	attachments := o.Attachments()
	if o.GetProp(PostPropsAttachments) != nil {
		o.AddProp(PostPropsAttachments, attachments)
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
	if o.GetProp(PostPropsAttachments) != nil {
		o.AddProp(PostPropsAttachments, o.Attachments())
	}
	if attachments, ok := o.GetProp(PostPropsAttachments).([]*SlackAttachment); ok {
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

	combined := append(nonce, sealed...) //nolint:makezero
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
