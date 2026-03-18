// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package request

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContext_WithSession(t *testing.T) {
	t.Run("returns new context with empty session when session is nil", func(t *testing.T) {
		originalCtx := TestContext(t)

		newCtx := originalCtx.WithSession(nil)

		require.NotNil(t, newCtx)
		assert.NotSame(t, originalCtx, newCtx, "should return a new context instance")
		assert.Empty(t, newCtx.Session().Id)
		assert.Empty(t, newCtx.Session().UserId)
		assert.Empty(t, newCtx.Session().Token)
	})

	t.Run("returns new context when session is provided", func(t *testing.T) {
		originalCtx := TestContext(t)
		session := &model.Session{
			Id:     "session-id",
			UserId: "user-id",
			Token:  "token",
		}

		newCtx := originalCtx.WithSession(session)

		require.NotNil(t, newCtx)
		assert.NotSame(t, originalCtx, newCtx, "should return a new context instance")

		assert.Equal(t, "session-id", newCtx.Session().Id)
		assert.Equal(t, "user-id", newCtx.Session().UserId)
		assert.Equal(t, "token", newCtx.Session().Token)

		assert.Empty(t, originalCtx.Session().Id)
	})
}
