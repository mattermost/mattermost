// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetTrueUpProfile(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	//Activated userss set to 10
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	//Mau set to 5
	mockUserStore.On("AnalyticsActiveCount", int64(MonthMilliseconds), model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false}).Return(int64(5), nil)
	//dau set to 2
	mockUserStore.On("AnalyticsActiveCount", int64(DayMilliseconds), model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false}).Return(int64(2), nil)
	mockStore.On("User").Return(&mockUserStore)

	mockWebhookStore := mocks.WebhookStore{}
	mockWebhookStore.On("AnalyticsIncomingCount", mock.Anything).Return(int64(1), nil)
	mockWebhookStore.On("AnalyticsOutgoingCount", mock.Anything).Return(int64(1), nil)
	mockStore.On("Webhook").Return(&mockWebhookStore)

	t.Run("missing license", func(t *testing.T) {
		_, err := th.App.GetTrueUpProfile()
		require.Error(t, err)
		require.True(t, strings.Contains(err.Error(), "True up review requires a license"))
	})

	t.Run("happy path - returns correct mau and activated users", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

		profile, err := th.App.GetTrueUpProfile()
		assert.NoError(t, err, "Unexpected error")

		require.NotNil(t, profile)
		assert.Equal(t, float64(5), profile["monthly_active_users"])
		assert.Equal(t, float64(2), profile["daily_active_users"])
		assert.Equal(t, float64(10), profile["total_activated_users"])
		assert.Equal(t, float64(1), profile["incoming_webhooks_count"])
		assert.Equal(t, float64(1), profile["outgoing_webhooks_count"])
	})
}
