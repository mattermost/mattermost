// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// TestBotAttributesAreEvaluatedByPermissionPolicy covers the two gaps around
// bots and user attributes: a value can be stored against a bot, and the
// upload permission check sends that value to the policy engine and returns
// the engine's decision.
//
// The engine itself is the enterprise evaluator. These tests stand in for a
// policy of `user.attributes.<field> == "Engineering"` by accepting the
// subject the check built and allowing only when that subject is the bot and
// carries the matching value.
func TestBotAttributesAreEvaluatedByPermissionPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		cfg.FeatureFlags.PermissionPolicies = true
	})

	group, appErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	fieldName := celSafeName()
	// Admin-managed fields are what a permission policy is allowed to reference,
	// and only a system admin can create one or write its values.
	rctx := th.emptyContextWithCallerID(th.SystemAdminUser.Id)
	field, appErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    group.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttrManaged: "admin",
		},
	}, false, "")
	require.Nil(t, appErr)

	createBot := func(t *testing.T) *model.Bot {
		t.Helper()
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username: model.NewUsername(),
			OwnerId:  th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		t.Cleanup(func() { _ = th.App.PermanentDeleteBot(th.Context, bot.UserId) })
		return bot
	}

	setValue := func(t *testing.T, bot *model.Bot, value string) {
		t.Helper()
		raw, err := json.Marshal(value)
		require.NoError(t, err)
		_, appErr := th.App.UpsertPropertyValues(rctx, []*model.PropertyValue{{
			TargetID:   bot.UserId,
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    group.ID,
			FieldID:    field.ID,
			Value:      raw,
		}}, model.PropertyFieldObjectTypeUser, bot.UserId, "")
		require.Nil(t, appErr)
		require.NoError(t, th.App.Srv().Store().Attributes().RefreshAttributes())
	}

	subjectFor := func(t *testing.T, bot *model.Bot) *model.Subject {
		t.Helper()
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, bot.UserId, model.SystemUserRoleId, th.BasicChannel.Id)
		require.Nil(t, appErr)
		require.True(t, subject.IsBot)
		require.Equal(t, bot.UserId, subject.ID)
		return subject
	}

	eng := createBot(t)
	sales := createBot(t)
	setValue(t, eng, "Engineering")
	setValue(t, sales, "Sales")

	require.Equal(t, "Engineering", subjectFor(t, eng).Attributes[fieldName])
	require.Equal(t, "Sales", subjectFor(t, sales).Attributes[fieldName])

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = original })

	matches := func(userID, value string) func(model.AccessRequest) bool {
		return func(req model.AccessRequest) bool {
			if req.Action != model.AccessControlPolicyActionUploadFileAttachment || req.Resource.ID != th.BasicChannel.Id {
				return false
			}
			if req.Subject.ID != userID || !req.Subject.IsBot {
				return false
			}
			got, _ := req.Subject.Attributes[fieldName].(string)
			return got == value
		}
	}
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(matches(eng.UserId, "Engineering"))).
		Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil)).Once()
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(matches(sales.UserId, "Sales"))).
		Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil)).Once()

	botContext := func(t *testing.T, bot *model.Bot) request.CTX {
		t.Helper()
		session, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId: bot.UserId,
			Roles:  model.SystemUserRoleId,
		})
		require.Nil(t, appErr)
		return th.Context.WithSession(session)
	}

	engCtx := botContext(t, eng)
	require.True(t, th.App.HasPermissionToFileAction(engCtx, eng.UserId, model.SystemUserRoleId, th.BasicChannel.Id, model.AccessControlPolicyActionUploadFileAttachment))

	salesCtx := botContext(t, sales)
	require.False(t, th.App.HasPermissionToFileAction(salesCtx, sales.UserId, model.SystemUserRoleId, th.BasicChannel.Id, model.AccessControlPolicyActionUploadFileAttachment))

	// Changing the allowed bot's attribute must change the decision.
	setValue(t, eng, "Sales")
	require.Equal(t, "Sales", subjectFor(t, eng).Attributes[fieldName])
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(matches(eng.UserId, "Sales"))).
		Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil)).Once()
	require.False(t, th.App.HasPermissionToFileAction(engCtx, eng.UserId, model.SystemUserRoleId, th.BasicChannel.Id, model.AccessControlPolicyActionUploadFileAttachment))

	mockACS.AssertExpectations(t)
}
