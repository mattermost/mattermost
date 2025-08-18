// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOAuthAppPreSave(t *testing.T) {
	t.Run("WithClientSecret", func(t *testing.T) {
		a1 := OAuthApp{}
		a1.Id = NewId()
		a1.Name = "TestOAuthApp" + NewId()
		a1.CallbackUrls = []string{"https://nowhere.com"}
		a1.Homepage = "https://nowhere.com"
		a1.IconURL = "https://nowhere.com/icon_image.png"
		a1.ClientSecret = NewId()
		a1.PreSave()
		a1.Etag()
		a1.Sanitize()
	})

	t.Run("NoSecretGeneration", func(t *testing.T) {
		app := OAuthApp{
			Name:         "Test Client",
			CallbackUrls: []string{"https://example.com/callback"},
			Homepage:     "https://example.com",
		}

		app.PreSave()

		require.Empty(t, app.ClientSecret)
		require.NotEmpty(t, app.Id)
		require.NotZero(t, app.CreateAt)
		require.NotZero(t, app.UpdateAt)
		require.True(t, app.IsPublicClient())
		require.Equal(t, ClientAuthMethodNone, app.GetTokenEndpointAuthMethod())
	})
}

func TestOAuthAppPreUpdate(t *testing.T) {
	a1 := OAuthApp{}
	a1.Id = NewId()
	a1.Name = "TestOAuthApp" + NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	a1.IconURL = "https://nowhere.com/icon_image.png"
	a1.ClientSecret = NewId()
	a1.PreUpdate()
}

func TestOAuthAppIsValid(t *testing.T) {
	t.Run("RequiredFields", func(t *testing.T) {
		app := OAuthApp{}

		require.NotNil(t, app.IsValid())

		app.Id = NewId()
		require.NotNil(t, app.IsValid())

		app.CreateAt = 1
		require.NotNil(t, app.IsValid())

		app.UpdateAt = 1
		require.NotNil(t, app.IsValid())

		app.CreatorId = NewId()
		require.NotNil(t, app.IsValid())

		app.ClientSecret = NewId()
		require.NotNil(t, app.IsValid())

		app.Name = "TestOAuthApp"
		require.NotNil(t, app.IsValid())

		app.CallbackUrls = []string{"https://nowhere.com"}
		require.NotNil(t, app.IsValid())

		app.MattermostAppID = "Some app ID"
		require.NotNil(t, app.IsValid())

		app.Homepage = "https://nowhere.com"
		require.Nil(t, app.IsValid())

		app.IconURL = "https://nowhere.com/icon_image.png"
		require.Nil(t, app.IsValid())
	})

	t.Run("PublicClient", func(t *testing.T) {
		app := OAuthApp{
			Id:           NewId(),
			CreatorId:    NewId(),
			CreateAt:     1,
			UpdateAt:     1,
			Name:         "Test Public Client",
			CallbackUrls: []string{"https://example.com/callback"},
			Homepage:     "https://example.com",
		}

		require.Nil(t, app.IsValid())
		require.True(t, app.IsPublicClient())
		require.Equal(t, ClientAuthMethodNone, app.GetTokenEndpointAuthMethod())
	})

	t.Run("ConfidentialClient", func(t *testing.T) {
		app := OAuthApp{
			Id:           NewId(),
			CreatorId:    NewId(),
			CreateAt:     1,
			UpdateAt:     1,
			Name:         "Test Confidential Client",
			CallbackUrls: []string{"https://example.com/callback"},
			Homepage:     "https://example.com",
			ClientSecret: NewId(),
		}

		require.Nil(t, app.IsValid())
		require.False(t, app.IsPublicClient())
		require.Equal(t, ClientAuthMethodClientSecretPost, app.GetTokenEndpointAuthMethod())
	})
}
