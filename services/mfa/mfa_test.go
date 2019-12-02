// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mfa

import (
	b32 "encoding/base32"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateSecret(t *testing.T) {
	user := &model.User{Id: model.NewId(), Roles: "system_user"}

	config := model.Config{}
	config.SetDefaults()
	config.ServiceSettings.EnableMultifactorAuthentication = model.NewBool(true)
	configService := testutils.StaticConfigService{Cfg: &config}
	storeMock := mocks.Store{}
	userStoreMock := mocks.UserStore{}
	userStoreMock.On("UpdateMfaSecret", user.Id, mock.AnythingOfType("string")).Return(func(userId string, secret string) *model.AppError {
		return nil
	})
	storeMock.On("User").Return(&userStoreMock)

	mfa := Mfa{configService, &storeMock}

	secret, img, err := mfa.GenerateSecret(user)
	require.Nil(t, err)

	assert.Len(t, secret, 32)

	require.NotEmpty(t, img, "no image set")

	config.ServiceSettings.EnableMultifactorAuthentication = model.NewBool(false)

	_, _, err = mfa.GenerateSecret(user)
	require.NotNil(t, err)
}

func TestGetIssuerFromUrl(t *testing.T) {
	cases := []struct {
		Input    string
		Expected string
	}{
		{"http://somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"https://somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"https://some.website.com", url.QueryEscape("some.website.com")},
		{" https://www.somewebsite.com", url.QueryEscape("somewebsite.com")},
		{"http://somewebsite.com/chat", url.QueryEscape("somewebsite.com/chat")},
		{"somewebsite.com ", url.QueryEscape("somewebsite.com")},
		{"http://localhost:8065", url.QueryEscape("localhost:8065")},
		{"", "Mattermost"},
		{"  ", "Mattermost"},
	}

	for _, c := range cases {
		assert.Equal(t, c.Expected, getIssuerFromUrl(c.Input))
	}
}

func TestActivate(t *testing.T) {
	user := &model.User{Id: model.NewId(), Roles: "system_user"}

	config := model.Config{}
	config.SetDefaults()
	config.ServiceSettings.EnableMultifactorAuthentication = model.NewBool(true)
	configService := testutils.StaticConfigService{Cfg: &config}
	storeMock := mocks.Store{}
	userStoreMock := mocks.UserStore{}
	userStoreMock.On("UpdateMfaActive", user.Id, mock.AnythingOfType("bool")).Return(func(userId string, active bool) *model.AppError {
		return nil
	})
	storeMock.On("User").Return(&userStoreMock)

	mfa := Mfa{configService, &storeMock}

	user.MfaSecret = b32.StdEncoding.EncodeToString([]byte(model.NewRandomString(MFA_SECRET_SIZE)))

	token := dgoogauth.ComputeCode(user.MfaSecret, time.Now().UTC().Unix()/30)

	err := mfa.Activate(user, fmt.Sprintf("%06d", token))
	require.Nil(t, err)
}
