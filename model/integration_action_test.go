// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
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
		newKey, keyErr := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, keyErr)
		_, _, err = DecodeAndVerifyTriggerId(triggerId, newKey)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.verify_signature_failed", err.Id)
	})
}

func TestPostActionIntegrationRequestToJson(t *testing.T) {
	o := PostActionIntegrationRequest{UserId: NewId(), Context: StringInterface{"a": "abc"}}
	j := o.ToJson()
	ro := PostActionIntegrationRequestFromJson(bytes.NewReader(j))

	assert.NotNil(t, ro)
	assert.Equal(t, o, *ro)
}

func TestPostActionIntegrationRequestFromJsonError(t *testing.T) {
	ro := PostActionIntegrationRequestFromJson(strings.NewReader(""))
	assert.Nil(t, ro)
}

func TestPostActionIntegrationResponseToJson(t *testing.T) {
	o := PostActionIntegrationResponse{Update: &Post{Id: NewId(), Message: NewId()}, EphemeralText: NewId()}
	j := o.ToJson()
	ro := PostActionIntegrationResponseFromJson(bytes.NewReader(j))

	assert.NotNil(t, ro)
	assert.Equal(t, o, *ro)
}

func TestPostActionIntegrationResponseFromJsonError(t *testing.T) {
	ro := PostActionIntegrationResponseFromJson(strings.NewReader(""))
	assert.Nil(t, ro)
}

func TestSubmitDialogRequestToJson(t *testing.T) {
	t.Run("all fine", func(t *testing.T) {
		request := SubmitDialogRequest{
			URL:        "http://example.org",
			CallbackId: NewId(),
			State:      "some state",
			UserId:     NewId(),
			ChannelId:  NewId(),
			TeamId:     NewId(),
			Submission: map[string]interface{}{
				"text":  "some text",
				"float": 1.2,
				"bool":  true,
			},
			Cancelled: true,
		}
		jsonRequest := request.ToJson()
		r := SubmitDialogRequestFromJson(bytes.NewReader(jsonRequest))

		require.NotNil(t, r)
		assert.Equal(t, request, *r)
	})
	t.Run("error", func(t *testing.T) {
		r := SubmitDialogRequestFromJson(strings.NewReader(""))
		assert.Nil(t, r)
	})
}

func TestSubmitDialogResponseToJson(t *testing.T) {
	t.Run("all fine", func(t *testing.T) {
		request := SubmitDialogResponse{
			Error: "some generic error",
			Errors: map[string]string{
				"text":  "some text",
				"float": "1.2",
				"bool":  "true",
			},
		}
		jsonRequest := request.ToJson()
		r := SubmitDialogResponseFromJson(bytes.NewReader(jsonRequest))

		require.NotNil(t, r)
		assert.Equal(t, request, *r)
	})
	t.Run("error", func(t *testing.T) {
		r := SubmitDialogResponseFromJson(strings.NewReader(""))
		assert.Nil(t, r)
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
}
