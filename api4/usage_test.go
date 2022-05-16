// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetPostsUsage(t *testing.T) {
	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.Client.Logout()

		usage, r, err := th.Client.GetPostsUsage()
		assert.Error(t, err)
		assert.Nil(t, usage)
		assert.Equal(t, http.StatusUnauthorized, r.StatusCode)
	})

	t.Run("good request returns response", func(t *testing.T) {
		// Following calls create a total of 15 posts
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.CreatePost()
		th.CreatePost()

		usage, r, err := th.Client.GetPostsUsage()
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, r.StatusCode)
		assert.NotNil(t, usage)
		assert.Equal(t, int64(10), usage.Count)
	})
}
