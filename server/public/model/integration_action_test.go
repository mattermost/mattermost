// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostAction_IsValid(t *testing.T) {
	tests := map[string]struct {
		action  *PostAction
		wantErr string
	}{
		"valid button action with http URL": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "",
		},
		"valid button action with http URL without Id": {
			action: &PostAction{
				Name: "Test Button",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "",
		},
		"valid button action with plugin path": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "/plugins/myplugin/action",
				},
			},
			wantErr: "",
		},
		"valid button action with relative plugin path": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "plugins/myplugin/action",
				},
			},
			wantErr: "",
		},
		"invalid integration URL": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "invalid-url",
				},
			},
			wantErr: "action must have an valid integration URL",
		},
		"valid select action with datasource": {
			action: &PostAction{
				Id:         "validid",
				Name:       "Test Select",
				Type:       PostActionTypeSelect,
				DataSource: PostActionDataSourceUsers,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "",
		},
		"valid select action with options": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Select",
				Type: PostActionTypeSelect,
				Options: []*PostActionOptions{
					{Text: "Opt1", Value: "opt1"},
				},
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "",
		},
		"select action with nil option": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Select",
				Type: PostActionTypeSelect,
				Options: []*PostActionOptions{
					nil,
					{Text: "Opt1", Value: "opt1"},
				},
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "select action contains nil option",
		},
		"missing name": {
			action: &PostAction{
				Id:   "validid",
				Type: PostActionTypeButton,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "action must have a name",
		},
		"invalid style": {
			action: &PostAction{
				Id:    "validid",
				Name:  "Test Button",
				Type:  PostActionTypeButton,
				Style: "invalid",
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "invalid style 'invalid' - must be one of [default, primary, success, good, warning, danger] or a hex color",
		},
		"valid style": {
			action: &PostAction{
				Id:    "validid",
				Name:  "Test Button",
				Type:  PostActionTypeButton,
				Style: "primary",
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "",
		},
		"button with options": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
				Options: []*PostActionOptions{
					{Text: "Opt1", Value: "opt1"},
				},
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "button action must not have options",
		},
		"button with datasource": {
			action: &PostAction{
				Id:         "validid",
				Name:       "Test Button",
				Type:       PostActionTypeButton,
				DataSource: PostActionDataSourceUsers,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "button action must not have a data source",
		},
		"select without datasource or options": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Select",
				Type: PostActionTypeSelect,
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "select action must have either DataSource or Options set",
		},
		"select with both datasource and options": {
			action: &PostAction{
				Id:         "validid",
				Name:       "Test Select",
				Type:       PostActionTypeSelect,
				DataSource: PostActionDataSourceUsers,
				Options: []*PostActionOptions{
					{Text: "Opt1", Value: "opt1"},
				},
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "select action cannot have both DataSource and Options set",
		},
		"invalid datasource": {
			action: &PostAction{
				Id:         "validid",
				Name:       "Test Select",
				Type:       PostActionTypeSelect,
				DataSource: "invalid",
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "invalid data_source 'invalid' for select action",
		},
		"missing integration": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Button",
				Type: PostActionTypeButton,
			},
			wantErr: "action must have integration settings",
		},
		"missing integration URL": {
			action: &PostAction{
				Id:          "validid",
				Name:        "Test Button",
				Type:        PostActionTypeButton,
				Integration: &PostActionIntegration{},
			},
			wantErr: "action must have an integration URL",
		},
		"invalid type": {
			action: &PostAction{
				Id:   "validid",
				Name: "Test Action",
				Type: "invalid",
				Integration: &PostActionIntegration{
					URL: "http://localhost:8065",
				},
			},
			wantErr: "invalid action type: must be 'button' or 'select'",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			err := tc.action.IsValid()
			if tc.wantErr == "" {
				assert.NoError(t, err, name)
			} else {
				assert.ErrorContains(t, err, tc.wantErr, name)
			}
		})
	}
}

func TestTriggerIdDecodeAndVerification(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	t.Run("should succeed decoding and validation", func(t *testing.T) {
		userId := NewId()
		clientTriggerId, triggerId, appErr := GenerateTriggerId(userId, key)
		require.Nil(t, appErr)
		decodedClientTriggerId, decodedUserId, appErr := DecodeAndVerifyTriggerId(triggerId, key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		assert.Nil(t, appErr)
		assert.Equal(t, clientTriggerId, decodedClientTriggerId)
		assert.Equal(t, userId, decodedUserId)
	})

	t.Run("should succeed decoding and validation through request structs", func(t *testing.T) {
		actionReq := &PostActionIntegrationRequest{
			UserId: NewId(),
		}
		clientTriggerId, triggerId, appErr := actionReq.GenerateTriggerId(key)
		require.Nil(t, appErr)
		dialogReq := &OpenDialogRequest{TriggerId: triggerId}
		decodedClientTriggerId, decodedUserId, appErr := dialogReq.DecodeAndVerifyTriggerId(key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		assert.Nil(t, appErr)
		assert.Equal(t, clientTriggerId, decodedClientTriggerId)
		assert.Equal(t, actionReq.UserId, decodedUserId)
	})

	t.Run("should fail on base64 decode", func(t *testing.T) {
		_, _, appErr := DecodeAndVerifyTriggerId("junk!", key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.base64_decode_failed", appErr.Id)
	})

	t.Run("should fail on trigger parsing", func(t *testing.T) {
		_, _, appErr := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("junk!")), key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.missing_data", appErr.Id)
	})

	t.Run("should fail on expired timestamp", func(t *testing.T) {
		_, _, appErr := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:1234567890:junksignature")), key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.expired", appErr.Id)
	})

	t.Run("should fail on base64 decoding signature", func(t *testing.T) {
		_, _, appErr := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:12345678900000:junk!")), key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.base64_decode_failed_signature", appErr.Id)
	})

	t.Run("should fail on bad signature", func(t *testing.T) {
		_, _, appErr := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:12345678900000:junk")), key, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.signature_decode_failed", appErr.Id)
	})

	t.Run("should fail on bad key", func(t *testing.T) {
		_, triggerId, appErr := GenerateTriggerId(NewId(), key)
		require.Nil(t, appErr)
		newKey, keyErr := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, keyErr)
		_, _, appErr = DecodeAndVerifyTriggerId(triggerId, newKey, OutgoingIntegrationRequestsDefaultTimeout*time.Second)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.decode_trigger_id.verify_signature_failed", appErr.Id)
	})
}

func TestPostActionIntegrationEquals(t *testing.T) {
	t.Run("equal uncomparable types", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": map[string]any{
						"a": 0,
					},
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": map[string]any{
						"a": 0,
					},
				},
			},
		}
		require.True(t, pa1.Equals(pa2))
	})

	t.Run("equal comparable types", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": "test",
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": "test",
				},
			},
		}
		require.True(t, pa1.Equals(pa2))
	})

	t.Run("non-equal types", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": map[string]any{
						"a": 0,
					},
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]any{
					"a": "test",
				},
			},
		}
		require.False(t, pa1.Equals(pa2))
	})

	t.Run("nil check in input integration", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{},
		}

		pa2 := &PostAction{
			Integration: nil,
		}

		require.False(t, pa1.Equals(pa2))
	})

	t.Run("nil check in original integration", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: nil,
		}

		pa2 := &PostAction{
			Integration: &PostActionIntegration{},
		}

		require.False(t, pa1.Equals(pa2))
	})

	t.Run("both nil", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: nil,
		}

		pa2 := &PostAction{
			Integration: nil,
		}

		require.True(t, pa1.Equals(pa2))
	})
}

func TestPostActionOptions_IsValid(t *testing.T) {
	tests := map[string]struct {
		options *PostActionOptions
		wantErr string
	}{
		"valid options": {
			options: &PostActionOptions{
				Text:  "Option 1",
				Value: "opt1",
			},
			wantErr: "",
		},
		"missing text": {
			options: &PostActionOptions{
				Value: "opt1",
			},
			wantErr: "text is required",
		},
		"missing value": {
			options: &PostActionOptions{
				Text: "Option 1",
			},
			wantErr: "value is required",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			err := tc.options.IsValid()
			if tc.wantErr == "" {
				assert.NoError(t, err)
			} else {
				assert.ErrorContains(t, err, tc.wantErr)
			}
		})
	}
}

func TestOpenDialogRequestIsValid(t *testing.T) {
	getBaseOpenDialogRequest := func() OpenDialogRequest {
		return OpenDialogRequest{
			TriggerId: "triggerId",
			URL:       "http://localhost:8065",
			Dialog: Dialog{
				CallbackId: "callbackid",
				Title:      "Some Title",
				Elements: []DialogElement{
					{
						DisplayName: "Element Name",
						Name:        "element_name",
						Type:        "text",
						Placeholder: "Enter a value",
					},
				},
				SubmitLabel:    "Submit",
				NotifyOnCancel: false,
				State:          "somestate",
			},
		}
	}

	t.Run("should pass validation", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail on empty url", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.URL = ""
		err := request.IsValid()
		assert.ErrorContains(t, err, "empty URL")
	})

	t.Run("should fail on empty trigger", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.TriggerId = ""
		err := request.IsValid()
		assert.ErrorContains(t, err, "empty trigger id")
	})

	t.Run("should fail on empty dialog title", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Title = ""
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid dialog title")
	})

	t.Run("should fail on wrong subtype and long dialog title", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements[0].SubType = "wrong SubType"
		request.Dialog.Title = "Very very long Dialog Name"
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid subtype")
		assert.ErrorContains(t, err, "invalid dialog title")
		t.Cleanup(func() {
			request.Dialog.Elements[0].SubType = ""
			request.Dialog.Title = "Some Title"
		})
	})

	t.Run("should fail on wrong dialog icon url", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.IconURL = "wrong url"
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid icon url")
	})

	t.Run("should pass on empty dialog icon url", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.IconURL = ""
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail on wrong minimal and maximal element length", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements[0].MinLength = 10
		request.Dialog.Elements[0].MaxLength = 9
		err := request.IsValid()
		assert.ErrorContains(t, err, "field is not valid")
		assert.ErrorContains(t, err, "min length should be less then max length")
	})

	t.Run("should fail on wrong element type", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements[0].Type = "wrong type"
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid element type")
	})

	t.Run("should fail on duplicate element name", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Radio element name",
			Name:        "element_name",
			Type:        "radio",
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "duplicate dialog element")
	})

	t.Run("should fail on wrong bool default value", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Bool element name",
			Name:        "bool_element_name",
			Type:        "bool",
			Default:     "wrong default",
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid default of bool")
	})

	t.Run("should pass on bool default value", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Bool element name",
			Name:        "bool_element_name",
			Type:        "bool",
			Default:     "true",
		})
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail on wrong select datasource value", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Select element name",
			Name:        "select_element_name",
			Type:        "select",
			DataSource:  "wrong DataSource",
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid data source")
	})

	t.Run("should fail on wrong select default value, and not fail with nil dereference", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Select element name",
			Name:        "select_element_name",
			Type:        "select",
			DataSource:  "",
			Default:     "default",
			Options: []*PostActionOptions{
				nil,
			},
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "default value \"default\" doesn't exist in options")
	})

	t.Run("should fail on wrong radio default value", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Radio element name",
			Name:        "radio_element_name",
			Type:        "radio",
			Default:     "default",
			Options: []*PostActionOptions{
				{
					Text:  "Text 1",
					Value: "value 1",
				},
			},
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "default value \"default\" doesn't exist in options")
	})
	t.Run("should fail on wrong radio default value, and not fail with nil dereference", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Radio element name",
			Name:        "radio_element_name",
			Type:        "radio",
			Default:     "default",
			Options: []*PostActionOptions{
				nil,
			},
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "default value \"default\" doesn't exist in options")
	})
	t.Run("should pass radio default value", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Radio element name",
			Name:        "radio_element_name",
			Type:        "radio",
			Default:     "default",
			Options: []*PostActionOptions{
				{
					Text:  "Text 1",
					Value: "value 1",
				},
				{
					Text:  "Text 2",
					Value: "default",
				},
			},
		})
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail on too long text placeholder", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements[0].Placeholder = strings.Repeat("x", 151)
		err := request.IsValid()
		assert.ErrorContains(t, err, "Placeholder cannot be longer than 150 characters")
	})
}

func TestValidateDateFormat(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{"valid YYYY-MM-DD format", "2025-01-15", false},
		{"valid date with leading zeros", "2025-01-01", false},
		{"valid leap year date", "2024-02-29", false},
		{"invalid format missing day", "2025-01", true},
		{"invalid format with slashes", "2025/01/15", true},
		{"invalid month", "2025-13-01", true},
		{"invalid day", "2025-01-32", true},
		{"invalid leap year", "2023-02-29", true},
		{"empty string", "", true},
		{"partial date", "2025", true},
		{"invalid format with time", "2025-01-15T10:30:00", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDateFormat(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateDateTimeFormat(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{"valid RFC3339 format", "2025-01-15T10:30:00Z", false},
		{"valid with timezone offset", "2025-01-15T10:30:00-05:00", false},
		{"valid with positive timezone", "2025-01-15T10:30:00+02:00", false},
		{"valid with milliseconds", "2025-01-15T10:30:00.123Z", false},
		{"invalid format without timezone", "2025-01-15T10:30:00", true},
		{"invalid date part", "2025-13-01T10:30:00Z", true},
		{"invalid time part", "2025-01-15T25:30:00Z", true},
		{"invalid timezone format", "2025-01-15T10:30:00GMT", true},
		{"date only format", "2025-01-15", true},
		{"empty string", "", true},
		{"invalid format with space", "2025-01-15 10:30:00", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDateTimeFormat(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestDialogElementDateTimeValidation(t *testing.T) {
	t.Run("should validate DialogElement with date/datetime type", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test Date",
			Name:        "test_date",
			Type:        "date",
			MinDate:     "2025-01-01",
			MaxDate:     "2025-12-31",
			Optional:    false,
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should validate DialogElement with datetime type and time properties", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			MinDate:      "2025-01-01",
			MaxDate:      "2025-12-31",
			TimeInterval: 30,
			DefaultTime:  "09:00",
			Optional:     false,
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should reject DialogElement with invalid min_date", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test Date",
			Name:        "test_date",
			Type:        "date",
			MinDate:     "invalid-date",
			Optional:    false,
		}
		err := element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "min_date")
	})

	t.Run("should reject DialogElement with invalid time_interval", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			TimeInterval: -1, // Invalid
			Optional:     false,
		}
		err := element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "time_interval")
	})

	t.Run("should reject DialogElement with time_interval that is not a divisor of 1440", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			TimeInterval: 729, // Invalid - not a divisor of 1440
			Optional:     false,
		}
		err := element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "divisor of 1440")
	})

	t.Run("should accept DialogElement with valid time_interval divisors", func(t *testing.T) {
		validIntervals := []int{1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 60, 72, 90, 120, 180, 240, 360, 480, 720, 1440}
		
		for _, interval := range validIntervals {
			element := DialogElement{
				DisplayName:  "Test DateTime",
				Name:         "test_datetime",
				Type:         "datetime",
				TimeInterval: interval,
				Optional:     false,
			}
			err := element.IsValid()
			assert.NoError(t, err, "time_interval %d should be valid", interval)
		}
	})

	t.Run("should reject DialogElement with invalid time_interval non-divisors", func(t *testing.T) {
		invalidIntervals := []int{7, 11, 13, 17, 23, 25, 33, 37, 50, 55, 70, 100, 300, 500, 729, 1000}
		
		for _, interval := range invalidIntervals {
			element := DialogElement{
				DisplayName:  "Test DateTime",
				Name:         "test_datetime",
				Type:         "datetime",
				TimeInterval: interval,
				Optional:     false,
			}
			err := element.IsValid()
			assert.Error(t, err, "time_interval %d should be invalid", interval)
			assert.Contains(t, err.Error(), "divisor of 1440")
		}
	})

	t.Run("should validate default_time format", func(t *testing.T) {
		validTimes := []string{"", "00:00", "12:30", "23:59"}
		for _, defaultTime := range validTimes {
			element := DialogElement{
				DisplayName: "Test DateTime",
				Name:        "test_datetime",
				Type:        "datetime",
				DefaultTime: defaultTime,
				Optional:    false,
			}
			err := element.IsValid()
			assert.NoError(t, err, "default_time %q should be valid", defaultTime)
		}

		invalidTimes := []string{"24:00", "12:60", "1:30", "12:3", "abc", "12:30:45"}
		for _, defaultTime := range invalidTimes {
			element := DialogElement{
				DisplayName: "Test DateTime",
				Name:        "test_datetime",
				Type:        "datetime",
				DefaultTime: defaultTime,
				Optional:    false,
			}
			err := element.IsValid()
			assert.Error(t, err, "default_time %q should be invalid", defaultTime)
			assert.Contains(t, err.Error(), "invalid time format")
		}
	})

	t.Run("should validate default_time alignment with time_interval", func(t *testing.T) {
		// Valid combinations - times that align with intervals
		validCombinations := []struct {
			defaultTime  string
			timeInterval int
		}{
			{"00:00", 30},   // 0 minutes % 30 = 0
			{"00:30", 30},   // 30 minutes % 30 = 0
			{"01:00", 30},   // 60 minutes % 30 = 0
			{"12:00", 15},   // 720 minutes % 15 = 0
			{"12:15", 15},   // 735 minutes % 15 = 0
			{"09:00", 60},   // 540 minutes % 60 = 0
			{"10:00", 120},  // 600 minutes % 120 = 0
			{"08:00", 240},  // 480 minutes % 240 = 0
		}

		for _, combo := range validCombinations {
			element := DialogElement{
				DisplayName:  "Test DateTime",
				Name:         "test_datetime",
				Type:         "datetime",
				DefaultTime:  combo.defaultTime,
				TimeInterval: combo.timeInterval,
				Optional:     false,
			}
			err := element.IsValid()
			assert.NoError(t, err, "default_time %q with time_interval %d should be valid", combo.defaultTime, combo.timeInterval)
		}

		// Invalid combinations - times that don't align with intervals
		invalidCombinations := []struct {
			defaultTime  string
			timeInterval int
		}{
			{"00:15", 30},   // 15 minutes % 30 = 15 (not 0)
			{"00:45", 30},   // 45 minutes % 30 = 15 (not 0)
			{"12:31", 30},   // 751 minutes % 30 = 1 (not 0)
			{"09:07", 15},   // 547 minutes % 15 = 7 (not 0)
			{"10:30", 60},   // 630 minutes % 60 = 30 (not 0)
			{"08:30", 120},  // 510 minutes % 120 = 30 (not 0)
		}

		for _, combo := range invalidCombinations {
			element := DialogElement{
				DisplayName:  "Test DateTime",
				Name:         "test_datetime",
				Type:         "datetime",
				DefaultTime:  combo.defaultTime,
				TimeInterval: combo.timeInterval,
				Optional:     false,
			}
			err := element.IsValid()
			assert.Error(t, err, "default_time %q with time_interval %d should be invalid", combo.defaultTime, combo.timeInterval)
			assert.Contains(t, err.Error(), "does not align with time_interval")
		}
	})

	t.Run("should use default time_interval of 60 minutes when zero", func(t *testing.T) {
		// Valid with default 60-minute interval
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			DefaultTime:  "09:00", // 540 minutes % 60 = 0 (valid)
			TimeInterval: 0,       // Should use default of 60
			Optional:     false,
		}
		err := element.IsValid()
		assert.NoError(t, err)

		// Invalid with default 60-minute interval
		element = DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			DefaultTime:  "09:15", // 555 minutes % 60 = 15 (invalid)
			TimeInterval: 0,       // Should use default of 60
			Optional:     false,
		}
		err = element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "does not align with time_interval 60 minutes")
	})
}
