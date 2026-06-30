// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// failingSigner is a test implementation of crypto.Signer that always returns an error
type failingSigner struct {
	err error
}

func (f *failingSigner) Public() crypto.PublicKey {
	return nil
}

func (f *failingSigner) Sign(rand io.Reader, digest []byte, opts crypto.SignerOpts) (signature []byte, err error) {
	return nil, f.err
}

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

func TestGenerateTriggerId(t *testing.T) {
	t.Run("should succeed with valid key", func(t *testing.T) {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)

		userId := NewId()
		clientTriggerId, triggerId, appErr := GenerateTriggerId(userId, key)
		assert.Nil(t, appErr)
		assert.NotEmpty(t, clientTriggerId)
		assert.NotEmpty(t, triggerId)
	})

	t.Run("should handle signer that returns error", func(t *testing.T) {
		// Create a signer that always returns an error
		badSigner := &failingSigner{err: assert.AnError}

		userId := NewId()
		_, _, appErr := GenerateTriggerId(userId, badSigner)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.generate_trigger_id.signing_failed", appErr.Id)
		assert.NotEmpty(t, appErr.Error())
	})

	t.Run("should handle invalid ECDSA key with nil D value", func(t *testing.T) {
		// Create an invalid ECDSA key with nil D (private key component)
		// This would normally panic in crypto/ecdsa, but our recover handler catches it
		invalidKey := &ecdsa.PrivateKey{
			PublicKey: ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     nil,
				Y:     nil,
			},
			D: nil,
		}

		userId := NewId()
		_, _, appErr := GenerateTriggerId(userId, invalidKey)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.generate_trigger_id.signing_failed", appErr.Id)
		assert.Contains(t, appErr.Error(), "invalid signing key")
	})

	t.Run("should handle ECDSA key with zero D value", func(t *testing.T) {
		// Create an ECDSA key with D set to zero (invalid private key)
		invalidKey := &ecdsa.PrivateKey{
			PublicKey: ecdsa.PublicKey{
				Curve: elliptic.P256(),
			},
			D: big.NewInt(0),
		}

		userId := NewId()
		_, _, appErr := GenerateTriggerId(userId, invalidKey)
		require.NotNil(t, appErr)
		assert.Equal(t, "interactive_message.generate_trigger_id.signing_failed", appErr.Id)
	})
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

	t.Run("should pass with select element with dynamic data_source", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName:   "Dynamic data_source",
			Name:          "dynamic_field",
			Type:          "select",
			DataSource:    "dynamic",
			DataSourceURL: "https://example.com/api/options",
		})
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail dynamic data_source without data_source_url", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName: "Dynamic data_source",
			Name:        "dynamic_field",
			Type:        "select",
			DataSource:  "dynamic",
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "dynamic data_source requires data_source_url")
	})

	t.Run("should fail dynamic data_source with malformed URL", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName:   "Dynamic data_source",
			Name:          "dynamic_field",
			Type:          "select",
			DataSource:    "dynamic",
			DataSourceURL: "not-a-valid-url",
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "invalid data_source_url for dynamic select")
	})

	t.Run("should pass dynamic data_source with HTTP URL", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName:   "Dynamic data_source",
			Name:          "dynamic_field",
			Type:          "select",
			DataSource:    "dynamic",
			DataSourceURL: "http://example.com/api/options",
		})
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should pass dynamic data_source with plugin URL", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName:   "Dynamic data_source",
			Name:          "dynamic_field",
			Type:          "select",
			DataSource:    "dynamic",
			DataSourceURL: "/plugins/myplugin/api/options",
		})
		err := request.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail dynamic data_source with static options", func(t *testing.T) {
		request := getBaseOpenDialogRequest()
		request.Dialog.Elements = append(request.Dialog.Elements, DialogElement{
			DisplayName:   "Dynamic data_source",
			Name:          "dynamic_field",
			Type:          "select",
			DataSource:    "dynamic",
			DataSourceURL: "https://example.com/api/options",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
			},
		})
		err := request.IsValid()
		assert.ErrorContains(t, err, "dynamic select element should not have static options")
	})
}

func TestIsValidLookupURL(t *testing.T) {
	tests := map[string]struct {
		url      string
		expected bool
	}{
		"valid HTTPS URL": {
			url:      "https://example.com/api/lookup",
			expected: true,
		},
		"valid HTTP URL": {
			url:      "http://example.com/api/lookup",
			expected: true,
		},
		"valid plugin path": {
			url:      "/plugins/myplugin/lookup",
			expected: true,
		},
		"empty URL": {
			url:      "",
			expected: false,
		},
		"path traversal attack": {
			url:      "/plugins/../../../etc/passwd",
			expected: false,
		},
		"double slash in plugin path": {
			url:      "/plugins//myplugin/lookup",
			expected: false,
		},
		"invalid scheme": {
			url:      "ftp://example.com/lookup",
			expected: false,
		},
		"relative path": {
			url:      "relative/path",
			expected: false,
		},
		"localhost HTTPS": {
			url:      "https://localhost:8080/api/lookup",
			expected: true,
		},
		"localhost HTTP": {
			url:      "http://localhost:8080/api/lookup",
			expected: true,
		},
		"127.0.0.1 HTTP": {
			url:      "http://127.0.0.1:8080/api/lookup",
			expected: true,
		},
		"malformed URL": {
			url:      "not-a-url",
			expected: false,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			result := IsValidLookupURL(tc.url)
			assert.Equal(t, tc.expected, result, "IsValidLookupURL(%q) = %v, want %v", tc.url, result, tc.expected)
		})
	}
}

func TestDialogSelectOption(t *testing.T) {
	t.Run("should create valid option", func(t *testing.T) {
		option := DialogSelectOption{
			Text:  "Test Option",
			Value: "test_value",
		}
		assert.Equal(t, "Test Option", option.Text)
		assert.Equal(t, "test_value", option.Value)
	})

	t.Run("should handle empty values", func(t *testing.T) {
		option := DialogSelectOption{
			Text:  "",
			Value: "",
		}
		assert.Equal(t, "", option.Text)
		assert.Equal(t, "", option.Value)
	})
}

func TestLookupDialogResponse(t *testing.T) {
	t.Run("should create valid response", func(t *testing.T) {
		response := LookupDialogResponse{
			Items: []DialogSelectOption{
				{Text: "Option 1", Value: "value1"},
				{Text: "Option 2", Value: "value2"},
			},
		}
		assert.Len(t, response.Items, 2)
		assert.Equal(t, "Option 1", response.Items[0].Text)
		assert.Equal(t, "value1", response.Items[0].Value)
	})

	t.Run("should handle empty response", func(t *testing.T) {
		response := LookupDialogResponse{
			Items: []DialogSelectOption{},
		}
		assert.Empty(t, response.Items)
	})

	t.Run("should handle nil items", func(t *testing.T) {
		response := LookupDialogResponse{}
		assert.Nil(t, response.Items)
	})
}

func TestDialogElementMultiSelectValidation(t *testing.T) {
	t.Run("should pass with multiselect on select element", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail with multiselect on non-select element", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Text Element",
			Name:        "text_element",
			Type:        "text",
			MultiSelect: true,
		}
		err := element.IsValid()
		assert.ErrorContains(t, err, "multiselect can only be used with select elements, got type \"text\"")
	})

	t.Run("should fail with multiselect on radio element", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Radio Element",
			Name:        "radio_element",
			Type:        "radio",
			MultiSelect: true,
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
			},
		}
		err := element.IsValid()
		assert.ErrorContains(t, err, "multiselect can only be used with select elements, got type \"radio\"")
	})

	t.Run("should fail with multiselect on bool element", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Bool Element",
			Name:        "bool_element",
			Type:        "bool",
			MultiSelect: true,
		}
		err := element.IsValid()
		assert.ErrorContains(t, err, "multiselect can only be used with select elements, got type \"bool\"")
	})

	t.Run("should pass with multiselect and valid comma-separated defaults", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			Default:     "opt1,opt2",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
				{Text: "Option 3", Value: "opt3"},
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should pass with multiselect and valid spaced comma-separated defaults", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			Default:     "opt1, opt2, opt3",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
				{Text: "Option 3", Value: "opt3"},
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail with multiselect and invalid default value not in options", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			Default:     "opt1,invalid_opt",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
			},
		}
		err := element.IsValid()
		assert.ErrorContains(t, err, "multiselect default value \"opt1,invalid_opt\" contains values not in options")
	})

	t.Run("should pass with multiselect and empty default", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			Default:     "",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should pass with multiselect and data source", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Multi Select Element",
			Name:        "multi_select",
			Type:        "select",
			MultiSelect: true,
			DataSource:  "users",
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should fail with single-select and comma-separated default values", func(t *testing.T) {
		element := &DialogElement{
			DisplayName: "Single Select Element",
			Name:        "single_select",
			Type:        "select",
			MultiSelect: false,
			Default:     "opt1,opt2",
			Options: []*PostActionOptions{
				{Text: "Option 1", Value: "opt1"},
				{Text: "Option 2", Value: "opt2"},
			},
		}
		err := element.IsValid()
		assert.ErrorContains(t, err, "default value \"opt1,opt2\" doesn't exist in options")
	})
}

func TestIsMultiSelectDefaultInOptions(t *testing.T) {
	options := []*PostActionOptions{
		{Text: "Option 1", Value: "opt1"},
		{Text: "Option 2", Value: "opt2"},
		{Text: "Option 3", Value: "opt3"},
		{Text: "Option 4", Value: "opt4"},
	}

	t.Run("should return true for empty default", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("", options)
		assert.True(t, result)
	})

	t.Run("should return true for single valid default", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1", options)
		assert.True(t, result)
	})

	t.Run("should return true for multiple valid defaults", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1,opt2", options)
		assert.True(t, result)
	})

	t.Run("should return true for multiple valid defaults with spaces", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1, opt2, opt3", options)
		assert.True(t, result)
	})

	t.Run("should return true for all valid defaults", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1,opt2,opt3,opt4", options)
		assert.True(t, result)
	})

	t.Run("should return false for single invalid default", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("invalid", options)
		assert.False(t, result)
	})

	t.Run("should return false for mixed valid and invalid defaults", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1,invalid,opt2", options)
		assert.False(t, result)
	})

	t.Run("should return false for all invalid defaults", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("invalid1,invalid2", options)
		assert.False(t, result)
	})

	t.Run("should handle empty values in comma-separated string", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1,,opt2", options)
		assert.True(t, result)
	})

	t.Run("should handle only commas", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions(",,", options)
		assert.True(t, result)
	})

	t.Run("should return true for single comma", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions(",", options)
		assert.True(t, result)
	})

	t.Run("should handle nil options", func(t *testing.T) {
		result := isMultiSelectDefaultInOptions("opt1", nil)
		assert.False(t, result)
	})

	t.Run("should handle options with nil entries", func(t *testing.T) {
		optionsWithNil := []*PostActionOptions{
			{Text: "Option 1", Value: "opt1"},
			nil,
			{Text: "Option 2", Value: "opt2"},
		}
		result := isMultiSelectDefaultInOptions("opt1,opt2", optionsWithNil)
		assert.True(t, result)
	})

	t.Run("should return false when value matches nil option", func(t *testing.T) {
		optionsWithNil := []*PostActionOptions{
			{Text: "Option 1", Value: "opt1"},
			nil,
		}
		result := isMultiSelectDefaultInOptions("opt1,opt2", optionsWithNil)
		assert.False(t, result)
	})
}

func TestSubmitDialogResponse_IsValid(t *testing.T) {
	validDialog := &Dialog{
		Title: "Test Dialog",
	}

	tests := map[string]struct {
		response *SubmitDialogResponse
		wantErr  string
	}{
		"error takes precedence - with error field": {
			response: &SubmitDialogResponse{
				Error: "something went wrong",
				Type:  "invalid_type",
				Form:  validDialog,
			},
			wantErr: "",
		},
		"error takes precedence - with errors field": {
			response: &SubmitDialogResponse{
				Errors: map[string]string{"field1": "required"},
				Type:   "invalid_type",
				Form:   validDialog,
			},
			wantErr: "",
		},
		"valid empty type with no form": {
			response: &SubmitDialogResponse{
				Type: "",
			},
			wantErr: "",
		},
		"valid ok type with no form": {
			response: &SubmitDialogResponse{
				Type: "ok",
			},
			wantErr: "",
		},
		"valid navigate type with no form": {
			response: &SubmitDialogResponse{
				Type: "navigate",
			},
			wantErr: "",
		},
		"valid form type with valid form": {
			response: &SubmitDialogResponse{
				Type: "form",
				Form: validDialog,
			},
			wantErr: "",
		},
		"invalid empty type with form": {
			response: &SubmitDialogResponse{
				Type: "",
				Form: validDialog,
			},
			wantErr: "form field must be nil for type \"\"",
		},
		"invalid ok type with form": {
			response: &SubmitDialogResponse{
				Type: "ok",
				Form: validDialog,
			},
			wantErr: "form field must be nil for type \"ok\"",
		},
		"invalid navigate type with form": {
			response: &SubmitDialogResponse{
				Type: "navigate",
				Form: validDialog,
			},
			wantErr: "form field must be nil for type \"navigate\"",
		},
		"invalid form type with no form": {
			response: &SubmitDialogResponse{
				Type: "form",
			},
			wantErr: "form field is required for form type",
		},
		"invalid form type with invalid form": {
			response: &SubmitDialogResponse{
				Type: "form",
				Form: &Dialog{}, // Invalid dialog
			},
			wantErr: "invalid form: 1 error occurred:\n\t* invalid dialog title \"\"",
		},
		"invalid type": {
			response: &SubmitDialogResponse{
				Type: "invalid",
			},
			wantErr: "invalid type \"invalid\", must be one of: empty, ok, form, navigate",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			err := tt.response.IsValid()
			if tt.wantErr == "" {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			}
		})
	}
}

func TestValidateRelativePattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"valid days", "+1d", true},
		{"valid weeks", "+2w", true},
		{"valid months", "+3m", true},
		{"valid hours", "+2H", true},
		{"valid minutes", "+30M", true},
		{"valid seconds", "+90S", true},
		{"negative days", "-1d", true},
		{"negative hours", "-2H", true},
		{"multi-digit number", "+99d", true},
		{"max digits", "+999d", true},
		{"lowercase h rejected", "+1h", false},
		{"lowercase s rejected", "+1s", false},
		{"uppercase D rejected", "+1D", false},
		{"uppercase W rejected", "+1W", false},
		{"no number", "+d", false},
		{"empty", "", false},
		{"too long days", "+9999d", false},
		{"too long hours", "+9999H", false},
		{"too long minutes", "+9999M", false},
		{"too long seconds", "+9999S", false},
		{"no number hours", "+H", false},
		{"no number minutes", "+M", false},
		{"no number seconds", "+S", false},
		{"no sign", "1d", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, validateRelativePattern(tt.input))
		})
	}
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
		{"empty string", "", false}, // Empty string is valid (no error)
		{"partial date", "2025", true},
		{"valid datetime format (should extract date)", "2025-01-15T10:30:00", true},
		{"valid datetime with timezone", "2025-01-15T10:30:00Z", true},
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
		{"valid format without timezone", "2025-01-15T10:30:00", false},
		{"valid format without seconds", "2025-01-15T10:30", false},
		{"invalid date part", "2025-13-01T10:30:00Z", true},
		{"invalid time part", "2025-01-15T25:30:00Z", true},
		{"invalid timezone format", "2025-01-15T10:30:00GMT", true},
		{"date only format", "2025-01-15", true},
		{"empty string", "", false}, // Empty string is valid (no error)
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
			MinDate:      "2025-01-01T00:00:00Z",
			MaxDate:      "2025-12-31T23:59:59Z",
			TimeInterval: 30,
			Optional:     false,
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should validate DialogElement with datetime type and relative min/max", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			MinDate:      "+2H",
			MaxDate:      "+7d",
			TimeInterval: 30,
			Optional:     false,
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should accept datetime DialogElement with date-only min/max for backward compatibility", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			MinDate:      "2025-01-01",
			MaxDate:      "2025-12-31",
			TimeInterval: 30,
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
		assert.Contains(t, err.Error(), "invalid date format")
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

	t.Run("should use default time_interval of 60 minutes when zero", func(t *testing.T) {
		// Valid with explicit 60-minute interval
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			TimeInterval: DefaultTimeIntervalMinutes,
			Optional:     false,
		}
		err := element.IsValid()
		assert.NoError(t, err)

		// time_interval=0 means omitted — treated as default, should pass validation
		element = DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			TimeInterval: 0,
			Optional:     false,
		}
		err = element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should validate date element with DateTimeConfig.MinDate and MaxDate", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test Date",
			Name:        "test_date",
			Type:        "date",
			DateTimeConfig: &DialogDateTimeConfig{
				MinDate: "2025-01-01",
				MaxDate: "2025-12-31",
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should validate datetime element with DateTimeConfig.MinDate, MaxDate, and TimeInterval", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test DateTime",
			Name:        "test_datetime",
			Type:        "datetime",
			DateTimeConfig: &DialogDateTimeConfig{
				MinDate:      "2025-01-01T00:00:00Z",
				MaxDate:      "2025-12-31T23:59:59Z",
				TimeInterval: 30,
			},
		}
		err := element.IsValid()
		assert.NoError(t, err)
	})

	t.Run("should reject invalid MinDate in DateTimeConfig", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test Date",
			Name:        "test_date",
			Type:        "date",
			DateTimeConfig: &DialogDateTimeConfig{
				MinDate: "invalid-date",
			},
		}
		err := element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid date format")
	})

	t.Run("should reject invalid TimeInterval in DateTimeConfig", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test DateTime",
			Name:        "test_datetime",
			Type:        "datetime",
			DateTimeConfig: &DialogDateTimeConfig{
				TimeInterval: 729,
			},
		}
		err := element.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "divisor of 1440")
	})

	t.Run("DateTimeConfig should take precedence over legacy fields", func(t *testing.T) {
		element := DialogElement{
			DisplayName: "Test Date",
			Name:        "test_date",
			Type:        "date",
			MinDate:     "invalid-date",
			DateTimeConfig: &DialogDateTimeConfig{
				MinDate: "2025-01-01",
			},
		}
		cfg := element.EffectiveDateTimeConfig()
		assert.Equal(t, "2025-01-01", cfg.MinDate)
	})

	t.Run("legacy fields used when DateTimeConfig not provided", func(t *testing.T) {
		element := DialogElement{
			DisplayName:  "Test DateTime",
			Name:         "test_datetime",
			Type:         "datetime",
			MinDate:      "2025-01-01T00:00:00Z",
			MaxDate:      "2025-12-31T23:59:59Z",
			TimeInterval: 30,
		}
		cfg := element.EffectiveDateTimeConfig()
		assert.Equal(t, "2025-01-01T00:00:00Z", cfg.MinDate)
		assert.Equal(t, "2025-12-31T23:59:59Z", cfg.MaxDate)
		assert.Equal(t, 30, cfg.TimeInterval)
	})

	t.Run("ManualTimeEntry resolves via OR across new and deprecated fields", func(t *testing.T) {
		cases := []struct {
			name     string
			newField bool
			oldField bool
			expected bool
		}{
			{"both false", false, false, false},
			{"only new true", true, false, true},
			{"only deprecated true", false, true, true},
			{"both true", true, true, true},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				element := DialogElement{
					DisplayName: "Test DateTime",
					Name:        "test_datetime",
					Type:        "datetime",
					DateTimeConfig: &DialogDateTimeConfig{
						ManualTimeEntry:      tc.newField,
						AllowManualTimeEntry: tc.oldField,
					},
				}
				cfg := element.EffectiveDateTimeConfig()
				assert.Equal(t, tc.expected, cfg.ManualTimeEntry)
			})
		}
	})

	t.Run("ManualTimeEntry marshals under manual_time_entry JSON key", func(t *testing.T) {
		cfg := DialogDateTimeConfig{ManualTimeEntry: true}
		b, err := json.Marshal(cfg)
		require.NoError(t, err)
		assert.Contains(t, string(b), `"manual_time_entry":true`)
	})

	t.Run("deprecated allow_manual_time_entry payload still enables manual entry end-to-end", func(t *testing.T) {
		// Simulate a legacy integrator sending only the deprecated field.
		payload := []byte(`{"allow_manual_time_entry":true}`)
		var cfg DialogDateTimeConfig
		require.NoError(t, json.Unmarshal(payload, &cfg))
		require.False(t, cfg.ManualTimeEntry, "new field should remain zero-value after unmarshal")
		require.True(t, cfg.AllowManualTimeEntry, "deprecated field should unmarshal under its legacy tag")

		element := DialogElement{
			DisplayName:    "Test",
			Name:           "t",
			Type:           "datetime",
			DateTimeConfig: &cfg,
		}
		effective := element.EffectiveDateTimeConfig()
		assert.True(t, effective.ManualTimeEntry, "deprecated field alone should enable manual entry after EffectiveDateTimeConfig")
	})
}

func TestPost_PostActionPreserveState(t *testing.T) {
	t.Run("top-level post", func(t *testing.T) {
		p := &Post{
			Id:           "postid",
			IsPinned:     true,
			HasReactions: true,
			Props:        StringInterface{PostPropsFromWebhook: "true", "other": "x"},
		}
		state := p.PostActionPreserveState()
		assert.Equal(t, "true", state.Retain[PostPropsFromWebhook])
		assert.Contains(t, state.Remove, PostPropsOverrideUsername)
		assert.Contains(t, state.Remove, PostPropsOverrideIconURL)
		assert.Equal(t, "true", state.OriginalProps[PostPropsFromWebhook])
		assert.Equal(t, "x", state.OriginalProps["other"])
		assert.True(t, state.OriginalIsPinned)
		assert.True(t, state.OriginalHasReactions)
		assert.Equal(t, "postid", state.RootPostId)
	})

	t.Run("thread reply uses root id", func(t *testing.T) {
		p := &Post{Id: "replyid", RootId: "rootid"}
		assert.Equal(t, "rootid", p.PostActionPreserveState().RootPostId)
	})

	t.Run("original props snapshot", func(t *testing.T) {
		p := &Post{Props: StringInterface{"k": "v"}}
		state := p.PostActionPreserveState()
		p.Props["k"] = "mutated"
		p.Props["new"] = "y"
		assert.Equal(t, "v", state.OriginalProps["k"])
		assert.NotContains(t, state.OriginalProps, "new")
	})
}

func TestNormalizePostActionIntegrationFormat(t *testing.T) {
	assert.Equal(t, PostActionIntegrationFormatAttachment, NormalizePostActionIntegrationFormat(""))
	assert.Equal(t, PostActionIntegrationFormatAttachment, NormalizePostActionIntegrationFormat("  "))
	assert.Equal(t, PostActionIntegrationFormatAttachment, NormalizePostActionIntegrationFormat("ATTACHMENT"))
	assert.Equal(t, PostActionIntegrationFormatMmBlock, NormalizePostActionIntegrationFormat("mm_block"))
	assert.Equal(t, PostActionIntegrationFormatBlock, NormalizePostActionIntegrationFormat("block"))
	assert.Equal(t, PostActionIntegrationFormatCard, NormalizePostActionIntegrationFormat("card"))
	assert.Equal(t, PostActionIntegrationFormatAppsBinding, NormalizePostActionIntegrationFormat("apps_binding"))
	assert.Equal(t, PostActionIntegrationFormatAttachment, NormalizePostActionIntegrationFormat("unknown-thing"))
}

func TestValidateActionQuery(t *testing.T) {
	t.Run("nil map is valid", func(t *testing.T) {
		assert.NoError(t, ValidateActionQuery(nil))
	})

	t.Run("empty map is valid", func(t *testing.T) {
		assert.NoError(t, ValidateActionQuery(map[string]string{}))
	})

	t.Run("within bounds is valid", func(t *testing.T) {
		ctx := map[string]string{
			"alpha": "one",
			"beta":  "two",
		}
		assert.NoError(t, ValidateActionQuery(ctx))
	})

	t.Run("exceeds MaxActionQueryEntries", func(t *testing.T) {
		ctx := make(map[string]string, MaxActionQueryEntries+1)
		for i := range MaxActionQueryEntries + 1 {
			ctx[strconv.Itoa(i)] = "v"
		}
		err := ValidateActionQuery(ctx)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds maximum")
	})

	t.Run("key length exactly MaxActionQueryKeyLength is allowed", func(t *testing.T) {
		ctx := map[string]string{
			strings.Repeat("k", MaxActionQueryKeyLength): "value",
		}
		assert.NoError(t, ValidateActionQuery(ctx))
	})

	t.Run("key length MaxActionQueryKeyLength+1 is rejected", func(t *testing.T) {
		ctx := map[string]string{
			strings.Repeat("k", MaxActionQueryKeyLength+1): "value",
		}
		err := ValidateActionQuery(ctx)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "key exceeds")
	})

	t.Run("value length exactly MaxActionQueryValueLength is allowed", func(t *testing.T) {
		ctx := map[string]string{
			"key": strings.Repeat("v", MaxActionQueryValueLength),
		}
		assert.NoError(t, ValidateActionQuery(ctx))
	})

	t.Run("value length MaxActionQueryValueLength+1 is rejected", func(t *testing.T) {
		ctx := map[string]string{
			"key": strings.Repeat("v", MaxActionQueryValueLength+1),
		}
		err := ValidateActionQuery(ctx)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "value for")
	})

	t.Run("multiple violations triggers an error", func(t *testing.T) {
		// Too many entries AND every value is over-length. First detected
		// violation wins; only assert that an error is returned.
		ctx := make(map[string]string, MaxActionQueryEntries+1)
		for i := range MaxActionQueryEntries + 1 {
			ctx[strconv.Itoa(i)] = strings.Repeat("v", MaxActionQueryValueLength+1)
		}
		err := ValidateActionQuery(ctx)
		require.Error(t, err)
	})
}

func mmBlocksExternalEntry(url string, context map[string]any) map[string]any {
	entry := map[string]any{
		"type": MmBlocksActionTypeExternal,
		"url":  url,
	}
	if context != nil {
		entry["context"] = context
	}
	return entry
}

func mmBlocksOpenURLEntry(url string, query map[string]any) map[string]any {
	entry := map[string]any{
		"type": MmBlocksActionTypeOpenURL,
		"url":  url,
	}
	if query != nil {
		entry["query"] = query
	}
	return entry
}

// ensureMmBlocksReferenceActions adds mm_blocks buttons so each mm_blocks_actions key is referenced.
func ensureMmBlocksReferenceActions(p *Post) {
	actions, ok := coerceToStringAnyMap(p.GetProp(PostPropsMmBlocksActions))
	if !ok {
		return
	}
	blocks := make([]any, 0, len(actions))
	for id := range actions {
		blocks = append(blocks, map[string]any{
			"type": "button", "text": "Btn", "action_id": id,
		})
	}
	p.AddProp(PostPropsMmBlocks, blocks)
}

func TestGetMmBlocksActionSpec(t *testing.T) {
	t.Run("prop absent returns nil", func(t *testing.T) {
		p := &Post{}
		assert.Nil(t, p.GetMmBlocksActionSpec("btn1"))
	})

	t.Run("empty action id returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		assert.Nil(t, p.GetMmBlocksActionSpec(""))
	})

	t.Run("id not found returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		assert.Nil(t, p.GetMmBlocksActionSpec("missing"))
	})

	t.Run("external entry returns spec with url and context", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", map[string]any{"k": "v"}),
		})
		got := p.GetMmBlocksActionSpec("btn1")
		require.NotNil(t, got)
		assert.Equal(t, MmBlocksActionTypeExternal, got.Type)
		assert.Equal(t, "http://example.com/hook", got.URL)
		assert.Equal(t, "v", got.Context["k"])
	})

	t.Run("entry missing type returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{"url": "http://example.com/hook"},
		})
		assert.Nil(t, p.GetMmBlocksActionSpec("btn1"))
	})

	t.Run("entry with unknown type returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type": "bogus",
				"url":  "http://example.com/hook",
			},
		})
		assert.Nil(t, p.GetMmBlocksActionSpec("btn1"))
	})

	t.Run("wrong-shape prop returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, "not-a-map")
		assert.Nil(t, p.GetMmBlocksActionSpec("btn1"))
	})

	t.Run("entry value not an object returns nil", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": "not-an-object",
		})
		assert.Nil(t, p.GetMmBlocksActionSpec("btn1"))
	})
}

func TestValidateMmBlocksActions(t *testing.T) {
	t.Run("absent prop returns no error", func(t *testing.T) {
		p := &Post{}
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("string prop is rejected (cookie transport not yet supported)", func(t *testing.T) {
		// The cookie-transport PR will add proper validation for
		// encrypted-string payloads. Until then, any string value is
		// rejected so an integration session cannot bypass the
		// alphanumeric-key, URL, and bounds checks by simply storing a
		// raw string at the prop key.
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, "encrypted-cookie-blob")
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be a map")
	})

	t.Run("valid external entries return no error", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
			"btn2": mmBlocksExternalEntry("/plugins/myplugin/action", nil),
			"btn3": mmBlocksExternalEntry("plugins/myplugin/action", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("exceeding MaxMmBlocksActionsPerPost returns error", func(t *testing.T) {
		actions := make(map[string]any, MaxMmBlocksActionsPerPost+1)
		for i := range MaxMmBlocksActionsPerPost + 1 {
			actions["btn"+strconv.Itoa(i)] = mmBlocksExternalEntry("http://example.com/hook", nil)
		}
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, actions)
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds maximum")
	})

	t.Run("action id with hyphen is allowed", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"foo-bar": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("action id at MaxMmBlocksActionKeyLength is allowed", func(t *testing.T) {
		key := strings.Repeat("a", MaxMmBlocksActionKeyLength)
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			key: mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("action id over MaxMmBlocksActionKeyLength is rejected", func(t *testing.T) {
		key := strings.Repeat("a", MaxMmBlocksActionKeyLength+1)
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			key: mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds")
	})

	t.Run("action id with underscore is allowed", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"foo_bar": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("action id with space is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"FOO bar": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "underscores, or hyphens")
	})

	t.Run("empty URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "non-empty URL")
	})

	t.Run("path traversal in /plugins/ URL is rejected", func(t *testing.T) {
		// Defense-in-depth: a `..` segment in a /plugins/ URL can escape the
		// plugin namespace at request time. Bot-authored mm_blocks specs are
		// the origin point so we reject at save.
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("/plugins/../../../etc/passwd", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "path traversal")
	})

	t.Run("trailing /.. in /plugins/ URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("/plugins/myplugin/..", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "path traversal")
	})

	t.Run("percent-encoded traversal in /plugins/ URL is rejected", func(t *testing.T) {
		// doPluginRequest decodes the path via url.Parse before path.Clean,
		// so an encoded "%2e%2e%2f" would otherwise route to a different
		// plugin than the validator thinks it's protecting. Validator must
		// decode symmetrically to catch this at save time.
		for _, encoded := range []string{
			"/plugins/innocent/%2e%2e%2f/target/handler",
			"/plugins/innocent/%2E%2E%2F/target/handler",
			"/plugins/innocent/..%2f/target/handler",
			"/plugins/innocent/%2e%2e/",
			"/plugins/innocent/%2e%2e",
		} {
			p := &Post{}
			p.AddProp(PostPropsMmBlocksActions, map[string]any{
				"btn1": mmBlocksExternalEntry(encoded, nil),
			})
			ensureMmBlocksReferenceActions(p)
			err := ValidateMmBlocksActions(p)
			require.Error(t, err, "url=%q must be rejected", encoded)
			assert.Contains(t, err.Error(), "path traversal", "url=%q", encoded)
		}
	})

	t.Run("entry missing type is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{"url": "http://example.com/hook"},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid type or shape")
	})

	t.Run("entry with unknown type is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type": "bogus",
				"url":  "http://example.com/hook",
			},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid type or shape")
	})

	t.Run("entry value not an object is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": "not-an-object",
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be an object")
	})

	t.Run("javascript URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("javascript://alert(1)", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "valid integration URL")
	})

	t.Run("http URL is accepted", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://legit.com", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("/plugins/ URL is accepted", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("/plugins/foo", nil),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("wrong-shape raw prop is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, []string{"not-a-map"})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be a map")
	})

	t.Run("static query exceeding entry cap is rejected", func(t *testing.T) {
		query := make(map[string]any, MaxActionQueryEntries+1)
		for i := range MaxActionQueryEntries + 1 {
			query["k"+strconv.Itoa(i)] = "v"
		}
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":  MmBlocksActionTypeExternal,
				"url":   "http://example.com/hook",
				"query": query,
			},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "static query")
	})

	t.Run("static query value exceeding length cap is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":  MmBlocksActionTypeExternal,
				"url":   "http://example.com/hook",
				"query": map[string]any{"k": strings.Repeat("a", MaxActionQueryValueLength+1)},
			},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "static query")
	})

	t.Run("static context exceeding entry cap is rejected", func(t *testing.T) {
		ctx := make(map[string]any, MaxActionQueryEntries+1)
		for i := range MaxActionQueryEntries + 1 {
			ctx["k"+strconv.Itoa(i)] = "v"
		}
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":    MmBlocksActionTypeExternal,
				"url":     "http://example.com/hook",
				"context": ctx,
			},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "context exceeds maximum")
	})

	t.Run("static context key exceeding length cap is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":    MmBlocksActionTypeExternal,
				"url":     "http://example.com/hook",
				"context": map[string]any{strings.Repeat("a", MaxActionQueryKeyLength+1): "v"},
			},
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "context key exceeds")
	})

	t.Run("orphan mm_blocks_actions entry is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocks, []any{
			map[string]any{"type": "button", "text": "Go", "action_id": "needed"},
		})
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"needed": mmBlocksExternalEntry("http://example.com/hook", nil),
			"unused": mmBlocksExternalEntry("http://example.com/other", nil),
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not referenced")
	})

	t.Run("missing mm_blocks_actions entry is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocks, []any{
			map[string]any{"type": "button", "text": "Go", "action_id": "needed"},
		})
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"other": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "missing entry")
	})

	t.Run("mm_blocks_actions without interactive references is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must only define actions referenced")
	})

	t.Run("interactive control without mm_blocks_actions is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocks, []any{
			map[string]any{"type": "button", "text": "Go", "action_id": "act"},
		})
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "requires mm_blocks_actions")
	})

	t.Run("valid openURL entries return no error", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("https://example.com/page", nil),
			"open2": mmBlocksOpenURLEntry("/team/channels/town-square", map[string]any{"q": "1"}),
		})
		ensureMmBlocksReferenceActions(p)
		assert.NoError(t, ValidateMmBlocksActions(p))
	})

	t.Run("openURL empty URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "non-empty URL")
	})

	t.Run("openURL javascript URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("javascript://alert(1)", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "http or https")
	})

	t.Run("openURL protocol-relative URL is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("//evil.example/phish", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protocol-relative")
	})

	t.Run("openURL path traversal is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("/team/../admin", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "path traversal")
	})

	t.Run("openURL /plugins/ path is rejected", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("/plugins/myplugin/handler", nil),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "plugin paths are not allowed")
	})

	t.Run("openURL static query exceeding entry cap is rejected", func(t *testing.T) {
		query := make(map[string]any, MaxActionQueryEntries+1)
		for i := range MaxActionQueryEntries + 1 {
			query["k"+strconv.Itoa(i)] = "v"
		}
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"open1": mmBlocksOpenURLEntry("https://example.com", query),
		})
		ensureMmBlocksReferenceActions(p)
		err := ValidateMmBlocksActions(p)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "static query")
	})
}

func TestStripActionIntegrations_MmBlocksActions(t *testing.T) {
	t.Run("strips mm_blocks_actions prop", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
		})
		p.StripActionIntegrations()
		assert.Nil(t, p.GetProp(PostPropsMmBlocksActions))
	})

	t.Run("post without mm_blocks_actions prop does not panic", func(t *testing.T) {
		p := &Post{}
		assert.NotPanics(t, func() {
			p.StripActionIntegrations()
		})
		assert.Nil(t, p.GetProp(PostPropsMmBlocksActions))
	})

	t.Run("post with both attachments and mm_blocks_actions cleans both", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsAttachments, []*MessageAttachment{
			{
				Actions: []*PostAction{
					{
						Id:          "a1",
						Name:        "Button",
						Type:        PostActionTypeButton,
						Integration: &PostActionIntegration{URL: "http://example.com/hook"},
					},
				},
			},
		})
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", nil),
		})

		p.StripActionIntegrations()

		// mm_blocks_actions prop should be removed entirely.
		assert.Nil(t, p.GetProp(PostPropsMmBlocksActions))

		// Attachment actions should remain but with nil Integration.
		attachments := p.Attachments()
		require.Len(t, attachments, 1)
		require.Len(t, attachments[0].Actions, 1)
		assert.Nil(t, attachments[0].Actions[0].Integration)
	})
}

func TestGetAction_MmBlocksFallback(t *testing.T) {
	t.Run("returns attachment action when present", func(t *testing.T) {
		attachmentAction := &PostAction{
			Id:          "a1",
			Name:        "Attach Button",
			Type:        PostActionTypeButton,
			Integration: &PostActionIntegration{URL: "http://example.com/attach"},
		}
		p := &Post{}
		p.AddProp(PostPropsAttachments, []*MessageAttachment{
			{Actions: []*PostAction{attachmentAction}},
		})

		got := p.GetAction("a1")
		require.NotNil(t, got)
		assert.Same(t, attachmentAction, got)
	})

	t.Run("synthesizes PostAction from mm_blocks_actions when no attachment match", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/hook", map[string]any{"k": "v"}),
		})

		got := p.GetAction("btn1")
		require.NotNil(t, got)
		assert.Equal(t, "btn1", got.Id)
		assert.Equal(t, PostActionTypeButton, got.Type)
		require.NotNil(t, got.Integration)
		assert.Equal(t, "http://example.com/hook", got.Integration.URL)
		assert.Equal(t, "v", got.Integration.Context["k"])
	})

	t.Run("synthesized URL pre-merges spec static query", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":  MmBlocksActionTypeExternal,
				"url":   "http://example.com/hook",
				"query": map[string]any{"source": "fleet-status"},
			},
		})

		got := p.GetAction("btn1")
		require.NotNil(t, got)
		require.NotNil(t, got.Integration)
		assert.Equal(t, "http://example.com/hook?source=fleet-status", got.Integration.URL)
	})

	t.Run("synthesized URL preserves existing query and adds spec static query", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":  MmBlocksActionTypeExternal,
				"url":   "http://example.com/hook?team=alpha",
				"query": map[string]any{"source": "fleet-status"},
			},
		})

		got := p.GetAction("btn1")
		require.NotNil(t, got)
		require.NotNil(t, got.Integration)
		// url.Values.Encode() sorts keys alphabetically.
		assert.Contains(t, got.Integration.URL, "source=fleet-status")
		assert.Contains(t, got.Integration.URL, "team=alpha")
	})

	t.Run("attachment wins when id matches both attachment and mm_blocks action", func(t *testing.T) {
		attachmentAction := &PostAction{
			Id:          "btn1",
			Name:        "Attach Button",
			Type:        PostActionTypeButton,
			Integration: &PostActionIntegration{URL: "http://example.com/attach"},
		}
		p := &Post{}
		p.AddProp(PostPropsAttachments, []*MessageAttachment{
			{Actions: []*PostAction{attachmentAction}},
		})
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": mmBlocksExternalEntry("http://example.com/inline", nil),
		})

		got := p.GetAction("btn1")
		require.NotNil(t, got)
		assert.Same(t, attachmentAction, got)
		assert.Equal(t, "http://example.com/attach", got.Integration.URL)
	})

	t.Run("returns nil when id matches neither", func(t *testing.T) {
		p := &Post{}
		p.AddProp(PostPropsAttachments, []*MessageAttachment{
			{Actions: []*PostAction{{Id: "other", Name: "X", Type: PostActionTypeButton, Integration: &PostActionIntegration{URL: "http://example.com"}}}},
		})
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"something": mmBlocksExternalEntry("http://example.com/hook", nil),
		})

		assert.Nil(t, p.GetAction("missing"))
	})

	t.Run("returns nil when spec URL is unparseable and static query merge fails", func(t *testing.T) {
		// Defense-in-depth: ValidateMmBlocksActions should reject this at
		// save time, but if a malformed URL slips through, GetAction must
		// not silently fire the bare URL with the static query dropped.
		p := &Post{}
		p.AddProp(PostPropsMmBlocksActions, map[string]any{
			"btn1": map[string]any{
				"type":  MmBlocksActionTypeExternal,
				"url":   "http://example.com/%%%bad",
				"query": map[string]any{"source": "fleet"},
			},
		})

		assert.Nil(t, p.GetAction("btn1"))
	})
}

func TestMmBlocksContextMap(t *testing.T) {
	t.Run("empty string returns nil", func(t *testing.T) {
		assert.Nil(t, MmBlocksContextMap(""))
	})

	t.Run("valid JSON object string is parsed into a map", func(t *testing.T) {
		got := MmBlocksContextMap(`{"k":"v","n":1}`)
		require.NotNil(t, got)
		assert.Equal(t, "v", got["k"])
		// JSON numbers decode to float64.
		assert.Equal(t, float64(1), got["n"])
	})

	t.Run("non-JSON string is wrapped under context key", func(t *testing.T) {
		got := MmBlocksContextMap("hello world")
		require.NotNil(t, got)
		assert.Equal(t, "hello world", got["context"])
	})

	t.Run("JSON null falls back to wrap (m is nil after unmarshal)", func(t *testing.T) {
		got := MmBlocksContextMap("null")
		require.NotNil(t, got)
		assert.Equal(t, "null", got["context"])
	})

	t.Run("JSON array falls back to wrap (target type mismatch)", func(t *testing.T) {
		got := MmBlocksContextMap("[1,2,3]")
		require.NotNil(t, got)
		assert.Equal(t, "[1,2,3]", got["context"])
	})

	t.Run("JSON number falls back to wrap (target type mismatch)", func(t *testing.T) {
		got := MmBlocksContextMap("42")
		require.NotNil(t, got)
		assert.Equal(t, "42", got["context"])
	})

	t.Run("malformed JSON falls back to wrap", func(t *testing.T) {
		got := MmBlocksContextMap(`{"unclosed":`)
		require.NotNil(t, got)
		assert.Equal(t, `{"unclosed":`, got["context"])
	})
}
