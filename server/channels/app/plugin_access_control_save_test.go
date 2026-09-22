// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSavePluginAccessControlPolicyWriteGuards(t *testing.T) {
	notFoundErr := model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound)

	t.Run("non-sysadmin self-excluding expression rejected", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)
		actingUserID := th.BasicUser.Id

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{}, int64(0), nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Equal(t, "app.pap.save_policy.self_exclusion", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
		mockACS.AssertExpectations(t)
	})

	t.Run("sysadmin may save self-excluding expression", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)
		adminID := th.SystemAdminUser.Id

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()
		mockACS.On("SavePolicy", mock.MatchedBy(func(c request.CTX) bool {
			return c.Session() != nil && c.Session().UserId == adminID
		}), mock.Anything).Return(p, nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, adminID, p)
		require.Nil(t, appErr)
		mockACS.AssertNotCalled(t, "QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything)
		mockACS.AssertExpectations(t)
	})

	t.Run("masking on: non-admin cannot submit unheld literals", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = true
		}).InitBasic(t)
		actingUserID := th.BasicUser.Id

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		valueErr := model.NewAppError("ValidateExpressionValuesForCaller", "app.pap.save_policy.forbidden", nil, "", http.StatusForbidden)
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()
		mockACS.On("ValidateExpressionValuesForCaller", mock.Anything, p.Rules[0].Expression, mock.Anything).
			Return(valueErr).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Equal(t, "app.pap.save_policy.forbidden", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "MergeExpressionWithMaskedValuesCanonical", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything)
		mockACS.AssertExpectations(t)
	})

	t.Run("masking on: plugin path skips store merge", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = true
		}).InitBasic(t)
		actingUserID := th.BasicUser.Id

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()
		mockACS.On("ValidateExpressionValuesForCaller", mock.Anything, p.Rules[0].Expression, mock.Anything).
			Return(nil).Once()
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{{Id: actingUserID}}, int64(1), nil).Once()
		mockACS.On("SavePolicy", mock.Anything, mock.Anything).Return(p, nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.Nil(t, appErr)
		mockACS.AssertNotCalled(t, "MergeExpressionWithMaskedValuesCanonical", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockACS.AssertExpectations(t)
	})
}
