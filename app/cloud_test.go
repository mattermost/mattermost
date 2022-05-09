// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	eMocks "github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

func TestGetCloudUsageForMessages(t *testing.T) {
	t.Run("test error cases", func(t *testing.T) {
		t.Run("returns error when GetCloudLimits fails", func(t *testing.T) {
			th := Setup(t)
			defer th.TearDown()

			errMsg := "Test limit error"

			cloud := &eMocks.CloudInterface{}
			cloud.On("GetCloudLimits", mock.Anything).Return(nil, errors.New(errMsg))
			th.App.Srv().Cloud = cloud

			usage, appErr := th.App.GetCloudUsageForMessages(mock.Anything)
			require.Zero(t, usage)
			require.ErrorContains(t, appErr, errMsg)
		})

		t.Run("returns error when AnalyticsPostCount fails", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			errMsg := "Test posts count error"

			cloud := &eMocks.CloudInterface{}
			max := 10
			mockLimits := &model.ProductLimits{
				Messages: &model.MessagesLimits{
					History: &max,
				},
			}
			cloud.On("GetCloudLimits", mock.Anything).Return(mockLimits, nil)
			th.App.Srv().Cloud = cloud

			mockStore := th.App.Srv().Store.(*mocks.Store)
			mockPostStore := mocks.PostStore{}
			mockPostStore.On("AnalyticsPostCount", mock.Anything, mock.Anything, mock.Anything).Return(int64(0), errors.New(errMsg))
			mockStore.On("Post").Return(&mockPostStore)

			usage, appErr := th.App.GetCloudUsageForMessages(mock.Anything)
			require.Zero(t, usage)
			require.ErrorContains(t, appErr, errMsg)
		})
	})

	t.Run("test valid cases", func(t *testing.T) {
		testCases := []struct {
			desc     string
			max      int
			count    int64
			expected int
		}{
			{
				desc:     "returns 100 when count == max",
				max:      10,
				count:    10,
				expected: 100,
			},
			{
				desc:     "returns 100 when count > max",
				max:      10,
				count:    11,
				expected: 100,
			},
			{
				desc:     "returns 0 when count is 0",
				max:      10,
				count:    0,
				expected: 0,
			},
			{
				desc:     "returns 0 when count is 1 and max is 1000",
				max:      1000,
				count:    1,
				expected: 0,
			},
			{
				desc:     "returns 0 when count is 99 and max is 1000",
				max:      1000,
				count:    99,
				expected: 0,
			},
			{
				desc:     "returns 10 when count is 100 and max is 1000",
				max:      1000,
				count:    100,
				expected: 10,
			},
			{
				desc:     "returns 10 when count is 199 and max is 1000",
				max:      1000,
				count:    199,
				expected: 10,
			},
			{
				desc:     "returns 20 when count is 200 and max is 1000",
				max:      1000,
				count:    200,
				expected: 20,
			},
		}
		for _, tc := range testCases {
			th := SetupWithStoreMock(t)
			defer th.TearDown()
			t.Run(tc.desc, func(t *testing.T) {
				t.Parallel()
				cloud := &eMocks.CloudInterface{}
				mockLimits := &model.ProductLimits{
					Messages: &model.MessagesLimits{
						History: &tc.max,
					},
				}
				cloud.On("GetCloudLimits", mock.Anything).Return(mockLimits, nil)
				th.App.Srv().Cloud = cloud

				mockStore := th.App.Srv().Store.(*mocks.Store)
				mockPostStore := mocks.PostStore{}
				mockPostStore.On("AnalyticsPostCount", mock.Anything, mock.Anything, mock.Anything).Return(tc.count, nil)
				mockStore.On("Post").Return(&mockPostStore)

				usage, appErr := th.App.GetCloudUsageForMessages(mock.Anything)
				require.Nil(t, appErr)
				require.Equal(t, tc.expected, usage)
			})
		}
	})
}
