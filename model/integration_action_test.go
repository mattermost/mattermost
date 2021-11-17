// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
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
