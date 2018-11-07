// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
	require.Nil(t, err)

	t.Run("should succeed decoding and validation", func(t *testing.T) {
		userId := NewId()
		clientTriggerId, triggerId, err := GenerateTriggerId(userId, key)
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
		require.Nil(t, keyErr)
		_, _, err = DecodeAndVerifyTriggerId(triggerId, newKey)
		require.NotNil(t, err)
		assert.Equal(t, "interactive_message.decode_trigger_id.verify_signature_failed", err.Id)
	})
}
