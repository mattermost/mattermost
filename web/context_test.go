// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRequireHookId(t *testing.T) {
	c := &Context{}
	t.Run("WhenHookIdIsValid", func(t *testing.T) {
		c.Params = &Params{HookId: "abcdefghijklmnopqrstuvwxyz"}
		c.RequireHookId()

		require.Nil(t, c.Err, "Hook Id is Valid. Should not have set error in context")
	})

	t.Run("WhenHookIdIsInvalid", func(t *testing.T) {
		c.Params = &Params{HookId: "abc"}
		c.RequireHookId()

		require.Error(t, c.Err, "Should have set Error in context")
		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode, "Should have set status as 400")
	})
}
