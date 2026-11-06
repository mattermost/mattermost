// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package request

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContext_CarriesLocalAdminCaller(t *testing.T) {
	rctx := TestContext(t)
	id, ok := model.CallerIDFromContext(rctx.Context())
	require.True(t, ok)
	assert.Equal(t, model.CallerIDLocalAdmin, id)
}

func TestContext_WithConnectionId(t *testing.T) {
	t.Run("returns new context with connection id", func(t *testing.T) {
		originalCtx := TestContext(t)
		connectionId := "test-connection-id-123"

		newCtx := originalCtx.WithConnectionId(connectionId)

		require.NotNil(t, newCtx)
		assert.NotSame(t, originalCtx, newCtx, "should return a new context instance")
		assert.Equal(t, connectionId, newCtx.ConnectionId())
		assert.Empty(t, originalCtx.ConnectionId(), "original context should remain unchanged")
	})

	t.Run("returns new context with empty connection id", func(t *testing.T) {
		originalCtx := TestContext(t)
		originalCtx = originalCtx.WithConnectionId("existing-id").(*Context)

		newCtx := originalCtx.WithConnectionId("")

		require.NotNil(t, newCtx)
		assert.NotSame(t, originalCtx, newCtx, "should return a new context instance")
		assert.Empty(t, newCtx.ConnectionId())
		assert.Equal(t, "existing-id", originalCtx.ConnectionId(), "original context should remain unchanged")
	})
}

func TestContext_WithSubject(t *testing.T) {
	t.Run("returns new context carrying the subject", func(t *testing.T) {
		originalCtx := TestContext(t).WithSession(&model.Session{UserId: "user-id"})
		subject := &model.Subject{ID: "user-id"}

		newCtx := originalCtx.WithSubject(subject)

		assert.NotSame(t, originalCtx, newCtx, "should return a new context instance")
		assert.Same(t, subject, newCtx.Subject())
		assert.Nil(t, originalCtx.Subject(), "original context should remain unchanged")
	})

	t.Run("keeps the subject when the session user is unchanged", func(t *testing.T) {
		rctx := TestContext(t).WithSession(&model.Session{Id: "a", UserId: "user-id"}).WithSubject(&model.Subject{ID: "user-id"})

		newCtx := rctx.WithSession(&model.Session{Id: "b", UserId: "user-id"})

		require.NotNil(t, newCtx.Subject())
		assert.Equal(t, "user-id", newCtx.Subject().ID)
	})

	t.Run("drops the subject when the session user changes", func(t *testing.T) {
		rctx := TestContext(t).WithSession(&model.Session{UserId: "user-id"}).WithSubject(&model.Subject{ID: "user-id"})

		assert.Nil(t, rctx.WithSession(&model.Session{UserId: "other-user"}).Subject())
		assert.Nil(t, rctx.WithSession(nil).Subject())
		assert.NotNil(t, rctx.Subject(), "original context should remain unchanged")
	})
}

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
