// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSendToastMessage(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("should return error when userID is empty", func(t *testing.T) {
		options := model.SendToastMessageOptions{
			Position: "bottom-right",
		}
		err := th.App.SendToastMessage("", "test-connection-id", "Test message", options)
		require.NotNil(t, err)
		assert.Equal(t, "app.toast.send_toast_message.user_id.app_error", err.Id)
	})

	t.Run("should return error when message is empty", func(t *testing.T) {
		options := model.SendToastMessageOptions{
			Position: "bottom-right",
		}
		err := th.App.SendToastMessage(th.BasicUser.Id, "test-connection-id", "", options)
		require.NotNil(t, err)
		assert.Equal(t, "app.toast.send_toast_message.message.app_error", err.Id)
	})

	t.Run("should successfully send toast to all user sessions", func(t *testing.T) {
		options := model.SendToastMessageOptions{
			Position: "top-center",
		}
		err := th.App.SendToastMessage(th.BasicUser.Id, "test-connection-id", "Test toast message", options)
		require.Nil(t, err)
	})

	t.Run("should successfully send toast to specific connection", func(t *testing.T) {
		options := model.SendToastMessageOptions{
			Position: "bottom-left",
		}
		err := th.App.SendToastMessage(th.BasicUser.Id, "test-connection-id", "Test toast message", options)
		require.Nil(t, err)
	})

	t.Run("should successfully send toast without position (default should be used)", func(t *testing.T) {
		options := model.SendToastMessageOptions{}
		err := th.App.SendToastMessage(th.BasicUser.Id, "test-connection-id", "Test toast message", options)
		require.Nil(t, err)
	})
}
