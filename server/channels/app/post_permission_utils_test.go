// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestPostsAPITypeCheck(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejects card post type", func(t *testing.T) {
		appErr := PostsAPITypeCheck("test", model.PostTypeCard)
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.post.disallowed_type.app_error", appErr.Id)
	})

	t.Run("allows empty type", func(t *testing.T) {
		appErr := PostsAPITypeCheck("test", "")
		assert.Nil(t, appErr)
	})

	t.Run("allows regular post types", func(t *testing.T) {
		appErr := PostsAPITypeCheck("test", model.PostTypeDefault)
		assert.Nil(t, appErr)
	})
}
