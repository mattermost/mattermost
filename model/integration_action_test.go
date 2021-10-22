// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTriggerIdDecodeAndVerification(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	t.Run("should succeed decoding and validation", func(t *testing.T) {
		userId := NewId()
		clientTriggerId, triggerId, err := GenerateTriggerId(userId, key)
		require.Nil(t, err)
		decodedClientTriggerId, decodedUserId, err := DecodeAndVerifyTriggerId(triggerId, key)
		assert.Nil(t, err)
		assert.Equal(t, clientTriggerId, decodedClientTriggerId)
		assert.Equal(t, userId, decodedUserId)
	})

	t.Run("should succeed decoding and validation through request structs", func(t *testing.T) {
		actionReq := &PostActionIntegrationRequest{
			UserId: NewId(),
		}
		clientTriggerId, triggerId, err := actionReq.GenerateTriggerId(key)
		require.Nil(t, err)
		dialogReq := &OpenDialogRequest{TriggerId: triggerId}
		decodedClientTriggerId, decodedUserId, err := dialogReq.DecodeAndVerifyTriggerId(key)
		assert.Nil(t, err)
		assert.Equal(t, clientTriggerId, decodedClientTriggerId)
		assert.Equal(t, actionReq.UserId, decodedUserId)
	})

	t.Run("should fail on base64 decode", func(t *testing.T) {
		_, _, err := DecodeAndVerifyTriggerId("junk!", key)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.base64_decode_failed", err.Id)
	})

	t.Run("should fail on trigger parsing", func(t *testing.T) {
		_, _, err := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("junk!")), key)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.missing_data", err.Id)
	})

	t.Run("should fail on expired timestamp", func(t *testing.T) {
		_, _, err := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:1234567890:junksignature")), key)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.expired", err.Id)
	})

	t.Run("should fail on base64 decoding signature", func(t *testing.T) {
		_, _, err := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:12345678900000:junk!")), key)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.base64_decode_failed_signature", err.Id)
	})

	t.Run("should fail on bad signature", func(t *testing.T) {
		_, _, err := DecodeAndVerifyTriggerId(base64.StdEncoding.EncodeToString([]byte("some-trigger-id:some-user-id:12345678900000:junk")), key)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.signature_decode_failed", err.Id)
	})

	t.Run("should fail on bad key", func(t *testing.T) {
		_, triggerId, err := GenerateTriggerId(NewId(), key)
		require.Nil(t, err)
		newKey, keyErr := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, keyErr)
		_, _, err = DecodeAndVerifyTriggerId(triggerId, newKey)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.verify_signature_failed", err.Id)
	})
}

func TestPostActionIntegrationEquals(t *testing.T) {
	t.Run("equal uncomparable types", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]interface{}{
					"a": map[string]interface{}{
						"a": 0,
					},
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]interface{}{
					"a": map[string]interface{}{
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
				Context: map[string]interface{}{
					"a": "test",
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]interface{}{
					"a": "test",
				},
			},
		}
		require.True(t, pa1.Equals(pa2))
	})

	t.Run("non-equal types", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]interface{}{
					"a": map[string]interface{}{
						"a": 0,
					},
				},
			},
		}
		pa2 := &PostAction{
			Integration: &PostActionIntegration{
				Context: map[string]interface{}{
					"a": "test",
				},
			},
		}
		require.False(t, pa1.Equals(pa2))
	})

	t.Run("nil check", func(t *testing.T) {
		pa1 := &PostAction{
			Integration: &PostActionIntegration{},
		}

		pa2 := &PostAction{
			Integration: nil,
		}

		require.False(t, pa1.Equals(pa2))
	})
}

type validable interface {
	IsValid() error
}

type validableTestCase struct {
	name      string
	validable validable
	hasError  bool
}

func TestOpenDialogRequestIsValid(t *testing.T) {
	validDialog := Dialog{CallbackId: "callback id", Title: "Test", IntroductionText: "introduction"}
	invalidDialog := Dialog{}

	testCases := []validableTestCase{
		{name: "trigger id empty", validable: &OpenDialogRequest{TriggerId: "", URL: "http://mattermost.com", Dialog: validDialog}, hasError: true},
		{name: "url empty", validable: &OpenDialogRequest{TriggerId: "trigger id", URL: "", Dialog: validDialog}, hasError: true},
		{name: "url malformed", validable: &OpenDialogRequest{TriggerId: "trigger id", URL: "mattermost.com", Dialog: validDialog}, hasError: true},
		{name: "invalid dialog", validable: &OpenDialogRequest{TriggerId: "trigger id", URL: "http://mattermost.com", Dialog: invalidDialog}, hasError: true},
		{name: "all valid", validable: &OpenDialogRequest{TriggerId: "trigger id", URL: "http://mattermost.com", Dialog: validDialog}, hasError: false},
	}

	validableTestcasesRun(t, testCases)
}

func TestDialogIsValid(t *testing.T) {
	makeValidDialogElementArray := func(nb int) (elements []DialogElement) {
		for i := 0; i < nb; i++ {
			elements = append(elements, DialogElement{DisplayName: "display", Name: fmt.Sprintf("Name %d", i), Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil})
		}
		return elements
	}
	invalidDialogElement := DialogElement{}

	testCases := []validableTestCase{
		{name: "callback id empty", validable: Dialog{CallbackId: "", Title: "title", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: true},
		{name: "title empty", validable: Dialog{CallbackId: "callbackid", Title: "", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: true},
		{name: "title too long", validable: Dialog{CallbackId: "callbackid", Title: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: true},
		{name: "intro text empty", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: true},
		{name: "icon url invalid", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "intro text", IconURL: "mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: true},
		{name: "two elements with same name", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: []DialogElement{{Name: "same name", DisplayName: "Display", Type: "text", MaxLength: 5}, {Name: "same name", DisplayName: "Display", Type: "text", MaxLength: 5}}}, hasError: true},
		{name: "too many elements", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(6)}, hasError: true},
		{name: "invalid element", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: []DialogElement{invalidDialogElement}}, hasError: true},
		{name: "all valid", validable: Dialog{CallbackId: "callbackid", Title: "title", IntroductionText: "intro text", IconURL: "http://mattermost.com/icon.svg", Elements: makeValidDialogElementArray(1)}, hasError: false},
	}

	validableTestcasesRun(t, testCases)
}

func TestDialogElementIsValid(t *testing.T) {
	genLongString := func(length int) string {
		s := ""
		for i := 0; i < length; i++ {
			s += "a"
		}
		return s
	}

	testCases := []validableTestCase{
		// general
		{name: "general: DisplayName empty", validable: DialogElement{DisplayName: "", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: DisplayName too big", validable: DialogElement{DisplayName: genLongString(5000), Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: name Empty", validable: DialogElement{DisplayName: "display", Name: "", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: name too big", validable: DialogElement{DisplayName: "display", Name: genLongString(5000), Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: help text too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: genLongString(5000), Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: type empty", validable: DialogElement{DisplayName: "display", Name: "name", Type: "", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		{name: "general: unknown type", validable: DialogElement{DisplayName: "display", Name: "name", Type: "unknown", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 3000, DataSource: "", Options: nil}, hasError: true},
		// Text
		{name: "text: unknown subtype", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "unknown", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "text: min negative", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: -1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "text: max lower than min", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 5, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "text: default too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "pla", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "text: placeholder too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "def", Placeholder: genLongString(151), HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "text: valid", validable: DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: false},
		// Textarea
		{name: "textarea: unknown subtype", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "unknown", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 0, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "textarea: min negative", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: -1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "textarea: max lower than min", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 5, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "textarea: default too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "default", Placeholder: "pla", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "textarea: placeholder too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "def", Placeholder: genLongString(3001), HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 4, DataSource: "", Options: nil}, hasError: true},
		{name: "textarea: valid", validable: DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: false},
		// Select
		{name: "select: no datasource or options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "select: wrong datasource", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "invalid", Options: nil}, hasError: true},
		{name: "select: default not in options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "not_option", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option", Value: "option"}}}, hasError: true},
		{name: "select: default too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: genLongString(3001), Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "users", Options: nil}, hasError: true},
		{name: "select: placeholder too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "", Placeholder: genLongString(3001), HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "users", Options: nil}, hasError: true},
		{name: "select: valid using options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "option", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option", Value: "option"}}}, hasError: false},
		{name: "select: valid using datasource", validable: DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "users", Options: nil}, hasError: false},
		// Checkbox
		{name: "checkbox: default not true or false", validable: DialogElement{DisplayName: "display", Name: "name", Type: "bool", Default: "none", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "checkbox: placeholder too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "bool", Default: "", Placeholder: genLongString(151), HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "checkbox: valid", validable: DialogElement{DisplayName: "display", Name: "name", Type: "bool", Default: "true", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: false},
		// Radio
		{name: "radio: no options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: nil}, hasError: true},
		{name: "radio: not enough options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}}}, hasError: true},
		{name: "radio: default not in options", validable: DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "option 3", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}}, hasError: true},
		{name: "radio: placeholder too big", validable: DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "", Placeholder: genLongString(151), HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}}, hasError: true},
		{name: "radio: valid", validable: DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "option 1", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}}, hasError: false},
	}

	validableTestcasesRun(t, testCases)
}

func validableTestcasesRun(t *testing.T, testCases []validableTestCase) {
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			result := testCase.validable.IsValid()
			t.Logf("result: %v", result)
			if testCase.hasError {
				require.Error(t, result)
				return
			}
			require.NoError(t, result)
		})
	}
}
