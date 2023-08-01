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

func TestGenerateAndSaveDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("generate token", func(t *testing.T) {
		token, err := th.App.GenerateAndSaveDesktopToken(time.Now().Add(-TTL).Unix(), th.BasicUser)
		assert.Nil(t, err)
		assert.NotNil(t, token)
	})
}

func TestValidateDesktopToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	authenticatedServerToken, err := th.App.GenerateAndSaveDesktopToken(time.Now().Add(-TTL).Unix(), th.BasicUser)
	require.Nil(t, err)
	require.NotNil(t, authenticatedServerToken)

	expiredServerToken, err := th.App.GenerateAndSaveDesktopToken(time.Now().Add(-ExpiredLength).Unix(), th.BasicUser2)
	require.Nil(t, err)
	require.NotNil(t, expiredServerToken)

	badUser := model.User{Id: "some_garbage_user_id"}
	badUserServerToken, err := th.App.GenerateAndSaveDesktopToken(time.Now().Add(-TTL).Unix(), &badUser)
	require.Nil(t, err)
	require.NotNil(t, badUserServerToken)

	t.Run("validate token", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken(*authenticatedServerToken, time.Now().Add(-TTL).Unix())
		assert.Nil(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, th.BasicUser.Id, user.Id)
	})

	t.Run("validate token - expired", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken(*expiredServerToken, time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("validate token - not authenticated", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken("not_real_token", time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.invalid", err.Id)
	})

	t.Run("validate token - bad user id", func(t *testing.T) {
		user, err := th.App.ValidateDesktopToken(*badUserServerToken, time.Now().Add(-TTL).Unix())
		assert.NotNil(t, err)
		assert.Nil(t, user)
		assert.Equal(t, "app.desktop_token.validate.no_user", err.Id)
	})
}
