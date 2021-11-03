// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"strconv"
	"strings"
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
	errorMsg  string
	validable validable
	hasError  bool
}

func makeTestOpenDialogRequest(t *testing.T, odrIn OpenDialogRequest, dependencies ...string) *OpenDialogRequest {
	t.Helper()

	odr := &OpenDialogRequest{
		TriggerId: "trigger id",
		URL:       "http://mattermost.com",
		Dialog:    makeTestDialog(t, Dialog{}),
	}

	for _, field := range dependencies {
		require.Contains(t, []string{"TriggerId", "URL", "Dialog"}, field)

		switch field {
		case "TriggerId":
			odr.TriggerId = odrIn.TriggerId
		case "URL":
			odr.URL = odrIn.URL
		case "Dialog":
			odr.Dialog = odrIn.Dialog
		}
	}

	return odr
}

func makeTestDialog(t *testing.T, dialogIn Dialog, dependencies ...string) Dialog {
	t.Helper()

	dialog := Dialog{
		CallbackId:       "callbackid",
		Title:            "title",
		IntroductionText: "intro text",
		IconURL:          "http://mattermost.com/icon.svg",
		Elements:         makeDialogElementArray(t, 1, "text", DialogElement{}),
	}

	for _, field := range dependencies {
		require.Contains(t, []string{"CallbackId", "Title", "IntroductionText", "IconURL", "Elements"}, field)

		switch field {
		case "CallbackId":
			dialog.CallbackId = dialogIn.CallbackId
		case "Title":
			dialog.Title = dialogIn.Title
		case "IntroductionText":
			dialog.IntroductionText = dialogIn.IntroductionText
		case "IconURL":
			dialog.IconURL = dialogIn.IconURL
		case "Elements":
			dialog.Elements = dialogIn.Elements
		}
	}

	return dialog
}

func makeDialogElementArray(t *testing.T, nb int, kind string, elementIn DialogElement, dependencies ...string) (elements []DialogElement) {
	t.Helper()

	for i := 0; i < nb; i++ {
		element := makeDialogElement(t, kind, elementIn, dependencies...)
		element.Name = strings.Replace(element.Name, "{idx}", strconv.Itoa(i), -1)
		elements = append(elements, element)
	}
	return elements
}

func makeDialogElement(t *testing.T, kind string, elementIn DialogElement, dependencies ...string) (elements DialogElement) {
	t.Helper()

	require.Contains(t, []string{"text", "textarea", "radio", "checkbox", "select"}, kind)

	var element DialogElement
	switch kind {
	case "text":
		element = DialogElement{DisplayName: "display", Name: "name", Type: "text", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150}
	case "textarea":
		element = DialogElement{DisplayName: "display", Name: "name", Type: "textarea", SubType: "password", Default: "default", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150}
	case "radio":
		element = DialogElement{DisplayName: "display", Name: "name", Type: "radio", Default: "option 1", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}}
	case "checkbox":
		element = DialogElement{DisplayName: "display", Name: "name", Type: "bool", Default: "true", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150}
	case "select":
		element = DialogElement{DisplayName: "display", Name: "name", Type: "select", Default: "option", Placeholder: "placeholder", HelpText: "help text", Optional: false, MinLength: 1, MaxLength: 150, DataSource: "users"}
	}

	for _, field := range dependencies {
		require.Contains(t, []string{
			"DisplayName",
			"Name",
			"Type",
			"SubType",
			"Default",
			"Placeholder",
			"HelpText",
			"Optional",
			"MinLength",
			"MaxLength",
			"DataSource",
			"Options"}, field)

		switch field {
		case "DisplayName":
			element.DisplayName = elementIn.DisplayName
		case "Name":
			element.Name = elementIn.Name
		case "Type":
			element.Type = elementIn.Type
		case "SubType":
			element.SubType = elementIn.SubType
		case "Default":
			element.Default = elementIn.Default
		case "Placeholder":
			element.Placeholder = elementIn.Placeholder
		case "HelpText":
			element.HelpText = elementIn.HelpText
		case "Optional":
			element.Optional = elementIn.Optional
		case "MinLength":
			element.MinLength = elementIn.MinLength
		case "MaxLength":
			element.MaxLength = elementIn.MaxLength
		case "DataSource":
			element.DataSource = elementIn.DataSource
		case "Options":
			element.Options = elementIn.Options
		}
	}

	return element
}

func TestOpenDialogRequestIsValid(t *testing.T) {
	testCases := []validableTestCase{
		{name: "trigger_id is empty", validable: makeTestOpenDialogRequest(t, OpenDialogRequest{TriggerId: ""}, "TriggerId"), hasError: true},
		{name: "url is empty", validable: makeTestOpenDialogRequest(t, OpenDialogRequest{URL: ""}, "URL"), hasError: true},
		{name: "url is invalid", validable: makeTestOpenDialogRequest(t, OpenDialogRequest{URL: "mattermost.com"}, "URL"), hasError: true},
		{name: "dialog is invalid: callback id is empty", validable: makeTestOpenDialogRequest(t, OpenDialogRequest{Dialog: Dialog{}}, "Dialog"), hasError: true},
		{name: "all valid", validable: makeTestOpenDialogRequest(t, OpenDialogRequest{}), hasError: false},
	}

	validableTestcasesRun(t, testCases)
}

func TestDialogIsValid(t *testing.T) {
	testCases := []validableTestCase{
		{name: "callback id is empty", validable: makeTestDialog(t, Dialog{CallbackId: ""}, "CallbackId"), hasError: true},
		{name: "title is empty", validable: makeTestDialog(t, Dialog{Title: ""}, "Title"), hasError: true},
		{name: "title is too long, max:24", validable: makeTestDialog(t, Dialog{Title: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}, "Title"), hasError: true},
		{name: "icon url is invalid", validable: makeTestDialog(t, Dialog{IconURL: "mattermost.com/icon.png"}, "IconURL"), hasError: true},
		{name: "element name 'same name' is duplicate", validable: makeTestDialog(t, Dialog{Elements: makeDialogElementArray(t, 2, "text", DialogElement{Name: "same name"}, "Name")}, "Elements"), hasError: true},
		{name: "too many elements provided, max:5", validable: makeTestDialog(t, Dialog{Elements: makeDialogElementArray(t, 6, "text", DialogElement{Name: "Name {idx}"}, "Name")}, "Elements"), hasError: true},
		{name: "element '' is not valid: display name is empty", validable: makeTestDialog(t, Dialog{Elements: []DialogElement{{}}}, "Elements"), hasError: true},
		{name: "valid dialog", validable: makeTestDialog(t, Dialog{}), hasError: false},
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
		{name: "general: DisplayName empty", errorMsg: "display name is empty", validable: makeDialogElement(t, "text", DialogElement{DisplayName: ""}, "DisplayName"), hasError: true},
		{name: "general: DisplayName too big", errorMsg: "display name is too long, max:24", validable: makeDialogElement(t, "text", DialogElement{DisplayName: genLongString(25)}, "DisplayName"), hasError: true},
		{name: "general: name Empty", errorMsg: "name is empty", validable: makeDialogElement(t, "text", DialogElement{Name: ""}, "Name"), hasError: true},
		{name: "general: name too big", errorMsg: "name is too long, max:300", validable: makeDialogElement(t, "text", DialogElement{Name: genLongString(301)}, "Name"), hasError: true},
		{name: "general: help text too big", errorMsg: "help text is too long, max:150", validable: makeDialogElement(t, "text", DialogElement{HelpText: genLongString(151)}, "HelpText"), hasError: true},
		{name: "general: type empty", errorMsg: "'' is not a valid type", validable: makeDialogElement(t, "text", DialogElement{Type: ""}, "Type"), hasError: true},
		{name: "general: unknown type", errorMsg: "'unknown' is not a valid type", validable: makeDialogElement(t, "text", DialogElement{Type: "unknown"}, "Type"), hasError: true},
		// Text
		{name: "text: unknown subtype", errorMsg: "'unknown' is not a valid subtype", validable: makeDialogElement(t, "text", DialogElement{SubType: "unknown"}, "SubType"), hasError: true},
		{name: "text: min negative", errorMsg: "min length must be at least 0", validable: makeDialogElement(t, "text", DialogElement{MinLength: -1}, "MinLength"), hasError: true},
		{name: "text: max lower than min", errorMsg: "max length must be greater than min length", validable: makeDialogElement(t, "text", DialogElement{MaxLength: 1, MinLength: 2}, "MaxLength", "MinLength"), hasError: true},
		{name: "text: default too big", errorMsg: "default can't be bigger than max length", validable: makeDialogElement(t, "text", DialogElement{Default: "", MaxLength: 5}, "Default", "MaxLength"), hasError: true},
		{name: "text: placeholder too big", errorMsg: "placeholder too long, max:150", validable: makeDialogElement(t, "text", DialogElement{Placeholder: genLongString(151)}, "Placeholder"), hasError: true},
		{name: "text: valid", validable: makeDialogElement(t, "text", DialogElement{}), hasError: false},
		// Textarea
		{name: "textarea: unknown subtype", errorMsg: "'unknown' is not a valid subtype", validable: makeDialogElement(t, "textarea", DialogElement{SubType: "unknown"}, "SubType"), hasError: true},
		{name: "textarea: min negative", errorMsg: "min length must be at least 0", validable: makeDialogElement(t, "textarea", DialogElement{MinLength: -1}, "MinLength"), hasError: true},
		{name: "textarea: max lower than min", errorMsg: "max length must be greater than min length", validable: makeDialogElement(t, "textarea", DialogElement{MaxLength: 1, MinLength: 2}, "MaxLength", "MinLength"), hasError: true},
		{name: "textarea: default too big", errorMsg: "default can't be bigger than max length", validable: makeDialogElement(t, "textarea", DialogElement{Default: "abcdef", MaxLength: 5}, "Default", "MaxLength"), hasError: true},
		{name: "textarea: placeholder too big", errorMsg: "placeholder too long, max:3000", validable: makeDialogElement(t, "textarea", DialogElement{Placeholder: genLongString(3001)}, "Placeholder"), hasError: true},
		{name: "textarea: valid", validable: makeDialogElement(t, "textarea", DialogElement{}), hasError: false},
		// Select
		{name: "select: no datasource or options", errorMsg: "neither data source or options has been given", validable: makeDialogElement(t, "select", DialogElement{DataSource: "", Options: nil}, "DataSource", "Options"), hasError: true},
		{name: "select: wrong datasource", errorMsg: "data source must be 'users' or 'channels'", validable: makeDialogElement(t, "select", DialogElement{DataSource: "unknown"}, "DataSource"), hasError: true},
		{name: "select: default not in options", errorMsg: "default value 'not_option' is not in the options", validable: makeDialogElement(t, "select", DialogElement{DataSource: "", Default: "not_option", Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}}, "DataSource", "Default", "Options"), hasError: true},
		{name: "select: default too big", errorMsg: "default too long, max:3000", validable: makeDialogElement(t, "select", DialogElement{Default: genLongString(3001), Options: []*PostActionOptions{{Text: "Option 1", Value: genLongString(3001)}, {Text: "Option 2", Value: "option 2"}}}, "Default", "Options"), hasError: true},
		{name: "select: placeholder too big", errorMsg: "placeholder too long, max:3000", validable: makeDialogElement(t, "select", DialogElement{Placeholder: genLongString(3001)}, "Placeholder"), hasError: true},
		{name: "select: valid using options", validable: makeDialogElement(t, "select", DialogElement{Options: []*PostActionOptions{{Text: "Option 1", Value: "option 1"}, {Text: "Option 2", Value: "option 2"}}, Default: "Option 1"}, "Options", "Default"), hasError: false},
		{name: "select: valid using datasource", validable: makeDialogElement(t, "select", DialogElement{DataSource: "users"}, "DataSource"), hasError: false},
		// Checkbox
		{name: "checkbox: default not true or false", errorMsg: "default must be 'true' or 'false'", validable: makeDialogElement(t, "checkbox", DialogElement{Default: "maybe"}, "Default"), hasError: true},
		{name: "checkbox: placeholder too big", errorMsg: "placeholder too long, max:150", validable: makeDialogElement(t, "checkbox", DialogElement{Placeholder: genLongString(515)}, "Placeholder"), hasError: true},
		{name: "checkbox: valid", validable: makeDialogElement(t, "checkbox", DialogElement{}), hasError: false},
		// Radio
		{name: "radio: no options", errorMsg: "options must have at least 2 elements", validable: makeDialogElement(t, "radio", DialogElement{Options: nil}, "Options"), hasError: true},
		{name: "radio: not enough options", errorMsg: "options must have at least 2 elements", validable: makeDialogElement(t, "radio", DialogElement{Options: []*PostActionOptions{{Value: "option 1", Text: "Option 1"}}}, "Options"), hasError: true},
		{name: "radio: default not in options", errorMsg: "default value 'option 3' is not in the options", validable: makeDialogElement(t, "radio", DialogElement{Default: "option 3"}, "Default"), hasError: true},
		{name: "radio: placeholder too big", errorMsg: "placeholder too long, max:150", validable: makeDialogElement(t, "radio", DialogElement{Placeholder: genLongString(151)}, "Placeholder"), hasError: true},
		{name: "radio: valid", validable: makeDialogElement(t, "radio", DialogElement{}), hasError: false},
	}

	validableTestcasesRun(t, testCases)
}

func validableTestcasesRun(t *testing.T, testCases []validableTestCase) {
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			result := testCase.validable.IsValid()
			if testCase.hasError {
				require.Error(t, result)
				errorMsg := testCase.name
				if testCase.errorMsg != "" {
					errorMsg = testCase.errorMsg
				}
				require.Equal(t, errorMsg, result.Error())
				return
			}
			require.NoError(t, result)
		})
	}
}
