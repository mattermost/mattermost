// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNotificationLevels(t *testing.T) {
	t.Run("notification levels are defined", func(t *testing.T) {
		assert.Equal(t, 300, LvlNotificationError.ID)
		assert.Equal(t, "NotificationError", LvlNotificationError.Name)

		assert.Equal(t, 301, LvlNotificationWarn.ID)
		assert.Equal(t, "NotificationWarn", LvlNotificationWarn.Name)

		assert.Equal(t, 302, LvlNotificationInfo.ID)
		assert.Equal(t, "NotificationInfo", LvlNotificationInfo.Name)

		assert.Equal(t, 303, LvlNotificationDebug.ID)
		assert.Equal(t, "NotificationDebug", LvlNotificationDebug.Name)

		assert.Equal(t, 304, LvlNotificationTrace.ID)
		assert.Equal(t, "NotificationTrace", LvlNotificationTrace.Name)
	})

	t.Run("notification multi-levels are defined", func(t *testing.T) {
		assert.Contains(t, MlvlNotificationError, LvlError)
		assert.Contains(t, MlvlNotificationError, LvlNotificationError)

		assert.Contains(t, MlvlNotificationWarn, LvlWarn)
		assert.Contains(t, MlvlNotificationWarn, LvlNotificationWarn)

		assert.Contains(t, MlvlNotificationInfo, LvlInfo)
		assert.Contains(t, MlvlNotificationInfo, LvlNotificationInfo)

		assert.Contains(t, MlvlNotificationDebug, LvlDebug)
		assert.Contains(t, MlvlNotificationDebug, LvlNotificationDebug)

		assert.Contains(t, MlvlNotificationTrace, LvlTrace)
		assert.Contains(t, MlvlNotificationTrace, LvlNotificationTrace)
	})
}
