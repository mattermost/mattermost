// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

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

	t.Run("directly assigning does cause the child to alter the parent", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctxClone := rctx
		rctxClone = RequestContextWithMaster(rctxClone)

		assert.True(t, HasMaster(rctx.Context()))
		assert.True(t, HasMaster(rctxClone.Context()))
	})

	t.Run("values get copied from parent", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctx = RequestContextWithMaster(rctx)
		rctxClone := rctx.Clone()

		assert.True(t, HasMaster(rctx.Context()))
		assert.True(t, HasMaster(rctxClone.Context()))
	})

	t.Run("changing the child does not alter the parent", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctxClone := rctx.Clone()
		rctxClone = RequestContextWithMaster(rctxClone)

		assert.False(t, HasMaster(rctx.Context()))
		assert.True(t, HasMaster(rctxClone.Context()))
	})

	t.Run("changing the parent does not alter the child", func(t *testing.T) {
		var rctx request.CTX = request.TestContext(t)
		rctxClone := rctx.Clone()
		rctx = RequestContextWithMaster(rctx)

		assert.True(t, HasMaster(rctx.Context()))
		assert.False(t, HasMaster(rctxClone.Context()))
	})
}
