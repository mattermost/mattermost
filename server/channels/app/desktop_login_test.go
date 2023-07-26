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

func TestSaveClientDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	existingErr := th.App.SaveClientDesktopToken("existing_token", time.Now().Unix())
	require.Nil(t, existingErr)

	t.Run("create token", func(t *testing.T) {
		err := th.App.SaveClientDesktopToken("new_token", time.Now().Unix())
		assert.Nil(t, err)

		user, err := th.App.ValidateDesktopToken("new_token", "any", time.Now().Add(-TTL).Unix())
		assert.Nil(t, user)
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("create token - already exists", func(t *testing.T) {
		err := th.App.SaveClientDesktopToken("existing_token", time.Now().Unix())
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.create.error", err.Id)
	})
}

func TestAuthenticateClientDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.SaveClientDesktopToken("unauthenticated_token", time.Now().Unix())
	require.Nil(t, err)

	err = th.App.SaveClientDesktopToken("expired_token", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)

	t.Run("authenticate token", func(t *testing.T) {
		err := th.App.AuthenticateClientDesktopToken("unauthenticated_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
		assert.Nil(t, err)
	})

	t.Run("authenticate token - expired", func(t *testing.T) {
		err := th.App.AuthenticateClientDesktopToken("expired_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
		assert.NotNil(t, err)
		assert.Equal(t, "app.desktop_token.authenticate.invalid_or_expired", err.Id)

		_, err = th.App.ValidateDesktopToken("expired_token", "any", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
	})
}

func TestGenerateAndSaveServerDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.SaveClientDesktopToken("unauthenticated_server_token", time.Now().Unix())
	require.Nil(t, err)

	err = th.App.SaveClientDesktopToken("expired_server_token", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)

	t.Run("generate token", func(t *testing.T) {
		token, err := th.App.GenerateAndSaveServerDesktopToken("unauthenticated_server_token", time.Now().Add(-TTL).Unix())
		assert.Nil(t, err)
		assert.NotNil(t, token)
	})

	t.Run("generate token - expired", func(t *testing.T) {
		token, err := th.App.GenerateAndSaveServerDesktopToken("expired_server_token", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, token)
	})
}

func TestValidateDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.SaveClientDesktopToken("authenticated_token", time.Now().Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateClientDesktopToken("authenticated_token", time.Now().Add(-TTL).Unix(), th.BasicUser)
	require.Nil(t, err)
	authenticatedServerToken, err := th.App.GenerateAndSaveServerDesktopToken("authenticated_token", time.Now().Add(-TTL).Unix())
	require.Nil(t, err)
	require.NotNil(t, authenticatedServerToken)

	err = th.App.SaveClientDesktopToken("expired_token_2", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateClientDesktopToken("expired_token_2", time.Now().Add(-ExpiredLength).Unix(), th.BasicUser)
	require.Nil(t, err)
	expiredServerToken, err := th.App.GenerateAndSaveServerDesktopToken("expired_token_2", time.Now().Add(-ExpiredLength).Unix())
	require.Nil(t, err)
	require.NotNil(t, expiredServerToken)

	err = th.App.SaveClientDesktopToken("unauthenticated_token_2", time.Now().Unix())
	require.Nil(t, err)

	badUser := model.User{Id: "some_garbage_user_id"}
	err = th.App.SaveClientDesktopToken("authenticated_token_bad_user", time.Now().Unix())
	require.Nil(t, err)
	err = th.App.AuthenticateClientDesktopToken("authenticated_token_bad_user", time.Now().Add(-TTL).Unix(), &badUser)
	require.Nil(t, err)
	badUserServerToken, err := th.App.GenerateAndSaveServerDesktopToken("authenticated_token_bad_user", time.Now().Add(-TTL).Unix())
	require.Nil(t, err)
	require.NotNil(t, badUserServerToken)

	t.Run("validate token", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("authenticated_token", *authenticatedServerToken, time.Now().Add(-TTL).Unix())
		assert.Nil(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, th.BasicUser.Id, user.Id)
	})

	t.Run("validate token - expired", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("expired_token_2", *expiredServerToken, time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("validate token - not authenticated", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("unauthenticated_token_2", "any", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("validate token - bad user id", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("authenticated_token_bad_user", *badUserServerToken, time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.no_user", err.Id)
	})
}
