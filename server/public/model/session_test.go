// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionIsValid(t *testing.T) {
	tcs := []struct {
		name          string
		input         Session
		expectedError string
	}{
		{
			"Invalid Id",
			Session{},
			"model.session.is_valid.id.app_error",
		},
		{
			"Invalid UserId",
			Session{
				Id: NewId(),
			},
			"model.session.is_valid.user_id.app_error",
		},
		{
			"Invalid CreateAt",
			Session{
				Id:     NewId(),
				UserId: NewId(),
			},
			"model.session.is_valid.create_at.app_error",
		},
		{
			"Invalid Roles",
			Session{
				Id:       NewId(),
				UserId:   NewId(),
				CreateAt: 1000,
				Roles:    strings.Repeat("a", UserRolesMaxLength+1),
			},
			"model.session.is_valid.roles_limit.app_error",
		},
		{
			"Valid",
			Session{
				Id:       NewId(),
				UserId:   NewId(),
				CreateAt: 1000,
				Roles:    strings.Repeat("a", UserRolesMaxLength),
			},
			"",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			appErr := tc.input.IsValid()
			if tc.expectedError != "" {
				require.NotNil(t, appErr)
				require.Equal(t, tc.expectedError, appErr.Id)
			} else {
				require.Nil(t, appErr)
			}
		})
	}
}

func TestSessionDeepCopy(t *testing.T) {
	sessionId := NewId()
	userId := NewId()
	mapKey := "key"
	mapValue := "val"

	session := &Session{Id: sessionId, Props: map[string]string{mapKey: mapValue}, TeamMembers: []*TeamMember{{UserId: userId, TeamId: "someteamId"}}}

	copySession := session.DeepCopy()
	copySession.Id = "changed"
	copySession.Props[mapKey] = "changed"
	copySession.TeamMembers[0].UserId = "changed"

	assert.Equal(t, sessionId, session.Id)
	assert.Equal(t, mapValue, session.Props[mapKey])
	assert.Equal(t, userId, session.TeamMembers[0].UserId)

	session = &Session{Id: sessionId}
	copySession = session.DeepCopy()

	assert.Equal(t, sessionId, copySession.Id)

	session = &Session{TeamMembers: []*TeamMember{}}
	copySession = session.DeepCopy()

	assert.Empty(t, copySession.TeamMembers)
}

func TestSessionCSRF(t *testing.T) {
	s := Session{}
	token := s.GetCSRF()
	assert.Empty(t, token)

	token = s.GenerateCSRF()
	assert.NotEmpty(t, token)

	token2 := s.GetCSRF()
	assert.NotEmpty(t, token2)
	assert.Equal(t, token, token2)
}

func TestSessionIsOAuthUser(t *testing.T) {
	testCases := []struct {
		Description string
		Session     Session
		isOAuthUser bool
	}{
		{"False on empty props", Session{}, false},
		{"True when key is set to true", Session{Props: StringMap{UserAuthServiceIsOAuth: strconv.FormatBool(true)}}, true},
		{"False when key is set to false", Session{Props: StringMap{UserAuthServiceIsOAuth: strconv.FormatBool(false)}}, false},
		{"Not affected by Session.IsOAuth being true", Session{IsOAuth: true}, false},
		{"Not affected by Session.IsOAuth being false", Session{IsOAuth: false, Props: StringMap{UserAuthServiceIsOAuth: strconv.FormatBool(true)}}, true},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			require.Equal(t, tc.isOAuthUser, tc.Session.IsOAuthUser())
		})
	}
}

func TestIsIntegration(t *testing.T) {
	testCases := []struct {
		Description   string
		Session       Session
		IsIntegration bool
	}{
		{"False on empty props", Session{}, false},
		{"True when is OAuth App", Session{IsOAuth: true}, true},
		{"True when session is bot", Session{Props: StringMap{SessionPropIsBot: SessionPropIsBotValue}}, true},
		{"True when session is user access token", Session{Props: StringMap{SessionPropType: SessionTypeUserAccessToken}}, true},
		{"Not affected by Props[UserAuthServiceIsOAuth]", Session{Props: StringMap{UserAuthServiceIsOAuth: strconv.FormatBool(true)}}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			require.Equal(t, tc.IsIntegration, tc.Session.IsIntegration())
		})
	}
}

func TestIsValidVoIPDeviceId(t *testing.T) {
	testCases := []struct {
		Description string
		Value       string
		Valid       bool
	}{
		{"empty string", "", false},
		{"missing token", PushNotifyAppleReactNative + ":", false},
		{"missing separator", PushNotifyAppleReactNative, false},
		{"missing platform", ":abcd", false},
		{"android is not VoIP-capable yet", PushNotifyAndroidReactNative + ":abcd", false},
		{"legacy bare apple prefix not allowed", "apple:abcd", false},
		{"valid apple_rn", PushNotifyAppleReactNative + ":abcd", true},
		{"valid apple_rnbeta", PushNotifyAppleReactNative + "beta:abcd", true},
		{"apple_rn-v2 tolerated", PushNotifyAppleReactNative + "-v2:abcd", true},
		{"apple_rn-v0 tolerated", PushNotifyAppleReactNative + "-v0:abcd", true},
		{"apple_rn-v999 tolerated", PushNotifyAppleReactNative + "-v999:abcd", true},
		{"apple_rn-voip is not stripped and fails allowlist", PushNotifyAppleReactNative + "-voip:abcd", false},
		{"apple_rn-vabc is not stripped and fails allowlist", PushNotifyAppleReactNative + "-vabc:abcd", false},
		{"apple_rn-v with empty version is not stripped and fails allowlist", PushNotifyAppleReactNative + "-v:abcd", false},
		{"apple_rn-v-2 with negative version is not stripped and fails allowlist", PushNotifyAppleReactNative + "-v-2:abcd", false},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			assert.Equal(t, tc.Valid, IsValidVoIPDeviceId(tc.Value))
		})
	}
}

func TestIsValidStandardDeviceId(t *testing.T) {
	testCases := []struct {
		Description string
		Value       string
		Valid       bool
	}{
		{"empty string", "", false},
		{"missing token", PushNotifyAppleReactNative + ":", false},
		{"missing separator", PushNotifyAppleReactNative, false},
		{"missing platform", ":abcd", false},
		{"legacy bare apple prefix not allowed", "apple:abcd", false},
		{"legacy bare android prefix not allowed", "android:abcd", false},
		{"valid apple_rn", PushNotifyAppleReactNative + ":abcd", true},
		{"valid apple_rnbeta", PushNotifyAppleReactNative + "beta:abcd", true},
		{"valid android_rn", PushNotifyAndroidReactNative + ":abcd", true},
		// Mobile encodes the app-version it speaks in a "-v<N>" suffix on
		// the platform (proxy strips it). Validator must tolerate it.
		{"apple_rn-v2", PushNotifyAppleReactNative + "-v2:abcd", true},
		{"apple_rnbeta-v2", PushNotifyAppleReactNative + "beta-v2:abcd", true},
		{"android_rn-v2", PushNotifyAndroidReactNative + "-v2:abcd", true},
		{"unknown platform with -v2", "foo_rn-v2:abcd", false},
		{"apple_rn-v0", PushNotifyAppleReactNative + "-v0:abcd", true},
		{"apple_rn-v999", PushNotifyAppleReactNative + "-v999:abcd", true},
		{"apple_rn-voip not stripped, fails allowlist", PushNotifyAppleReactNative + "-voip:abcd", false},
		{"apple_rn-vabc not stripped, fails allowlist", PushNotifyAppleReactNative + "-vabc:abcd", false},
		{"apple_rn-v with empty version not stripped", PushNotifyAppleReactNative + "-v:abcd", false},
		{"apple_rn-v-2 with negative version not stripped", PushNotifyAppleReactNative + "-v-2:abcd", false},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			assert.Equal(t, tc.Valid, IsValidStandardDeviceId(tc.Value))
		})
	}
}

func TestRedactDeviceId(t *testing.T) {
	testCases := []struct {
		Name     string
		Input    string
		Expected string
	}{
		{"empty", "", ""},
		{"no colon", "apple_rn", "apple_rn"},
		{"empty token after colon", "apple_rn:", "apple_rn"},
		{"short token passes through", PushNotifyAppleReactNative + ":1234", PushNotifyAppleReactNative + ":1234"},
		{"16-char token passes through", PushNotifyAppleReactNative + ":0123456789abcdef", PushNotifyAppleReactNative + ":0123456789abcdef"},
		{"17-char token truncated", PushNotifyAppleReactNative + ":0123456789abcdefg", PushNotifyAppleReactNative + ":0123456789abcdef…"},
		{"long token truncated", PushNotifyAndroidReactNative + ":abcdef0123456789cafebabe1234", PushNotifyAndroidReactNative + ":abcdef0123456789…"},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			assert.Equal(t, tc.Expected, RedactDeviceId(tc.Input))
		})
	}
}
