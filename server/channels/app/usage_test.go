// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/server/v7/channels/store/storetest/mocks"
)

func TestGetPostsUsage(t *testing.T) {
	t.Run("returns error when AnalyticsPostCount fails", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		errMsg := "Test posts count error"

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("AnalyticsPostCount", mock.Anything).Return(int64(0), errors.New(errMsg))
		mockStore.On("Post").Return(&mockPostStore)

		usage, appErr := th.App.GetPostsUsage()
		assert.Zero(t, usage)
		assert.ErrorContains(t, appErr, errMsg)
	})

	t.Run("returns rounded off count when AnalyticsPostCount returns valid count", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		var mockCount int64 = 4321
		var expected int64 = 4000

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockPostStore := mocks.PostStore{}
		mockPostStore.On("AnalyticsPostCount", mock.Anything).Return(mockCount, nil)
		mockStore.On("Post").Return(&mockPostStore)

		count, appErr := th.App.GetPostsUsage()
		assert.Nil(t, appErr)
		assert.Equal(t, expected, count)
	})
}
