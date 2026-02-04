// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestPluginContext(t *testing.T) {
	t.Run("creates plugin context with all fields from request context", func(t *testing.T) {
		rctx := request.TestContext(t)
		session := &model.Session{
			Id:     "session-id-123",
			UserId: "user-id-456",
		}
		rctx = rctx.WithSession(session).(*request.Context)
		rctx = rctx.WithRequestId("request-id-789").(*request.Context)
		rctx = rctx.WithIPAddress("192.168.1.1").(*request.Context)
		rctx = rctx.WithAcceptLanguage("en-US").(*request.Context)
		rctx = rctx.WithUserAgent("TestAgent/1.0").(*request.Context)
		rctx = rctx.WithConnectionId("connection-id-abc").(*request.Context)

		ctx := pluginContext(rctx)

		assert.Equal(t, "request-id-789", ctx.RequestId)
		assert.Equal(t, "session-id-123", ctx.SessionId)
		assert.Equal(t, "192.168.1.1", ctx.IPAddress)
		assert.Equal(t, "en-US", ctx.AcceptLanguage)
		assert.Equal(t, "TestAgent/1.0", ctx.UserAgent)
		assert.Equal(t, "connection-id-abc", ctx.ConnectionId)
	})

	t.Run("creates plugin context with empty connection id when not set", func(t *testing.T) {
		rctx := request.TestContext(t)

		ctx := pluginContext(rctx)

		assert.Empty(t, ctx.ConnectionId)
	})
}
