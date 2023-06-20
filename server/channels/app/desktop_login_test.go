// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	TTL           = time.Minute * 3
	ExpiredLength = time.Minute * 10
)

func TestCreateDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	existingErr := th.App.CreateDesktopToken("existing_token", time.Now().Unix())
	require.Nil(t, existingErr)

	t.Run("create token", func(t *testing.T) {
		err := th.App.CreateDesktopToken("new_token", time.Now().Unix())
		assert.Nil(t, err)

		user, err := th.App.ValidateDesktopToken("new_token", time.Now().Add(-TTL).Unix())
		assert.Nil(t, user)
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("create token - already exists", func(t *testing.T) {
		err := th.App.CreateDesktopToken("existing_token", time.Now().Unix())
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.create.collision", err.Id)
	})
}

func TestAuthenticateDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.CreateDesktopToken("unauthenticated_token", time.Now().Unix())
	require.Nil(t, err)

	err = th.App.CreateDesktopToken("expired_token", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)

	t.Run("authenticate token", func(t *testing.T) {
		err := th.App.AuthenticateDesktopToken("unauthenticated_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
		assert.Nil(t, err)

		user, err := th.App.ValidateDesktopToken("unauthenticated_token", time.Now().Add(-TTL).Unix())
		assert.Nil(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, th.BasicUser.Id, user.Id)
	})

	t.Run("authenticate token - expired", func(t *testing.T) {
		err := th.App.AuthenticateDesktopToken("expired_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.authenticate.invalid_or_expired", err.Id)

		_, err = th.App.ValidateDesktopToken("expired_token", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
	})
}

func TestValidateDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.CreateDesktopToken("authenticated_token", time.Now().Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateDesktopToken("authenticated_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
	require.Nil(t, err)

	err = th.App.CreateDesktopToken("expired_token_2", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateDesktopToken("expired_token_2", time.Now().Add(-ExpiredLength).Unix(), th.BasicUser)
	require.Nil(t, err)

	err = th.App.CreateDesktopToken("unauthenticated_token_2", time.Now().Unix())
	require.Nil(t, err)

	badUser := model.User{Id: "some_garbage_user_id"}
	err = th.App.CreateDesktopToken("authenticated_token_bad_user", time.Now().Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateDesktopToken("authenticated_token_bad_user", time.Now().Add(-TTL).Unix(), &badUser)
	require.Nil(t, err)

	t.Run("validate token", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("authenticated_token", time.Now().Add(-TTL).Unix())
		assert.Nil(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, th.BasicUser.Id, user.Id)
	})

	t.Run("validate token - expired", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("expired_token_2", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.expired", err.Id)
	})

	t.Run("validate token - not authenticated", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("unauthenticated_token_2", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("validate token - bad user id", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("authenticated_token_bad_user", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.no_user", err.Id)
	})
}
