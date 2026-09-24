// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestVerifyWipeSignature(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	signWith := func(t *testing.T, key *ecdsa.PrivateKey, claims jwt.Claims) string {
		t.Helper()
		signature, err := jwt.NewWithClaims(jwt.SigningMethodES256, claims).SignedString(key)
		require.NoError(t, err)
		return signature
	}

	t.Run("returns the user, device and ack a wipe push was signed for", func(t *testing.T) {
		signature := signWith(t, th.App.AsymmetricSigningKey(), pushJWTClaims{
			AckId:    "ackid",
			DeviceId: "testdevice",
			UserId:   th.BasicUser.Id,
		})

		claims, err := th.App.VerifyWipeSignature(signature)
		require.NoError(t, err)
		require.Equal(t, &WipeSignatureClaims{
			UserId:   th.BasicUser.Id,
			DeviceId: "testdevice",
			AckId:    "ackid",
		}, claims)
	})

	t.Run("rejects a signature carrying a malformed user id", func(t *testing.T) {
		signature := signWith(t, th.App.AsymmetricSigningKey(), pushJWTClaims{
			AckId:    "ackid",
			DeviceId: "testdevice",
			UserId:   "not-a-valid-user-id",
		})

		_, err := th.App.VerifyWipeSignature(signature)
		require.Error(t, err)
	})

	t.Run("rejects a signature signed by another server's key", func(t *testing.T) {
		otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)

		signature := signWith(t, otherKey, pushJWTClaims{
			AckId:    "ackid",
			DeviceId: "testdevice",
			UserId:   th.BasicUser.Id,
		})

		_, err = th.App.VerifyWipeSignature(signature)
		require.Error(t, err)
	})

	t.Run("rejects an unsigned token using the none algorithm", func(t *testing.T) {
		signature, err := jwt.NewWithClaims(jwt.SigningMethodNone, pushJWTClaims{
			AckId:    "ackid",
			DeviceId: "testdevice",
			UserId:   th.BasicUser.Id,
		}).SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)

		_, err = th.App.VerifyWipeSignature(signature)
		require.Error(t, err)
	})

	t.Run("rejects an empty signature", func(t *testing.T) {
		_, err := th.App.VerifyWipeSignature("")
		require.Error(t, err)
	})
}

// VerifyWipeSignature trusts the user id claim because only sendMobileWipeSignal sets it. If the
// regular notification path ever starts setting it too, every push signature becomes a valid
// wipe proof and this fails.
func TestRegularPushSignatureIsNotAcceptedAsAWipeSignature(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	handler := &testPushNotificationHandler{t: t, behavior: "simple"}
	pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
	t.Cleanup(pushServer.Close)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendPushNotifications = true
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
	})

	_, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  model.PushNotifyAppleReactNative + ":testdevice",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	appErr = th.App.sendPushNotificationToAllSessions(th.Context, &model.PushNotification{Type: model.PushTypeMessage}, th.BasicUser.Id, "")
	require.Nil(t, appErr)

	require.Eventually(t, func() bool {
		return len(handler.notifications()) == 1
	}, 2*time.Second, 10*time.Millisecond)

	_, err := th.App.VerifyWipeSignature(handler.notifications()[0].Signature)
	require.Error(t, err)
}
