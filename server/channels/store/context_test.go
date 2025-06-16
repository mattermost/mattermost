// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
)

func TestContextMaster(t *testing.T) {
	ctx := context.Background()

	m := WithMaster(ctx)
	assert.True(t, HasMaster(m))
}

func TestRequestContextWithMaster(t *testing.T) {
	t.Run("set and get", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)

		rctx = RequestContextWithMaster(rctx)
		assert.True(t, HasMaster(rctx.Context()))
	})

	t.Run("values get copied from original context", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctx = RequestContextWithMaster(rctx)
		rctxCopy := rctx

		assert.True(t, HasMaster(rctx.Context()))
		assert.True(t, HasMaster(rctxCopy.Context()))
	})

	t.Run("directly assigning does not cause the copy to alter the original context", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctxCopy := rctx
		rctxCopy = RequestContextWithMaster(rctxCopy)

		assert.False(t, HasMaster(rctx.Context()))
		assert.True(t, HasMaster(rctxCopy.Context()))
	})

	t.Run("directly assigning does not cause the original context to alter the copy", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctxCopy := rctx
		rctx = RequestContextWithMaster(rctx)

		assert.True(t, HasMaster(rctx.Context()))
		assert.False(t, HasMaster(rctxCopy.Context()))
	})
}
