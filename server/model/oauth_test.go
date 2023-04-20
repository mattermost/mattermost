// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOAuthAppPreSave(t *testing.T) {
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
}
