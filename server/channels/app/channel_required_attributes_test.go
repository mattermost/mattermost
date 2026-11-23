// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func requiredAttributesSessionCtx(th *TestHelper, user *model.User, roles string) request.CTX {
	return th.Context.WithSession(&model.Session{UserId: user.Id, Id: model.NewId(), Roles: roles})
}

func fieldIDsOf(fields []*model.PropertyField) []string {
	ids := make([]string, 0, len(fields))
	for _, field := range fields {
		ids = append(ids, field.ID)
	}
	return ids
}

func requireResolveError(t *testing.T, err error, id string, status int) {
	t.Helper()
	var appErr *model.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, id, appErr.Id)
	assert.Equal(t, status, appErr.StatusCode)
}

// protectField marks field as protected, which the property access hook refuses
// to let a person write values for.
func protectField(t *testing.T, th *TestHelper, field *model.PropertyField) {
	t.Helper()
	field.Attrs[model.PropertyAttrsProtected] = true
	_, err := th.App.Srv().Store().PropertyField().Update(field.GroupID, []*model.PropertyField{field}, nil)
	require.NoError(t, err)
}

func TestResolveRequiredChannelAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	// newExisting returns a helper, a channel administered by admin, and a plain
	// member of it. The channel is created before any field exists.
	newExisting := func(t *testing.T) (*TestHelper, *model.Channel, *model.User, *model.User) {
		t.Helper()
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		member := th.CreateUser(t)
		th.LinkUserToTeam(t, member, team)
		th.AddUserToChannel(t, member, channel)
		return th, channel, admin, member
	}

	t.Run("existing channel", func(t *testing.T) {
		t.Run("a settable required field with no value is missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
			assert.Empty(t, res.ValuesToWrite)
		})

		t.Run("a field with a value is not asked for", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
		})

		t.Run("a whitespace-only value counts as missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"   "`)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("an optional field is not asked for", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			createMissingAttributesField(t, th, "Optional", false, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
		})

		t.Run("a field the person can't set is skipped", func(t *testing.T) {
			th, channel, admin, member := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, member, model.SystemUserRoleId), member.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))

			res, appErr = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("a field with no editor is skipped, never missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			for _, fieldType := range []model.PropertyFieldType{model.PropertyFieldTypeDate, model.PropertyFieldTypeUser, model.PropertyFieldTypeMultiuser} {
				createMissingAttributesFieldOfType(t, th, fieldType, "No editor "+string(fieldType), true, model.PermissionLevelAdmin)
			}

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Len(t, res.Skipped, 3)
		})

		t.Run("a sent value satisfies its field and is returned for writing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			other := createMissingAttributesField(t, th, "Other", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"  ALPHA  "`)},
			})
			require.NoError(t, appErr)
			assert.Equal(t, []string{other.ID}, fieldIDsOf(res.Missing))
			require.Len(t, res.ValuesToWrite, 1)
			assert.Equal(t, field.GroupID, res.ValuesToWrite[0].GroupID)
			assert.Equal(t, field.ID, res.ValuesToWrite[0].FieldID)
			assert.JSONEq(t, `"ALPHA"`, string(res.ValuesToWrite[0].Value))
		})

		t.Run("a sent value the channel already holds is not written again", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			other := createMissingAttributesField(t, th, "Other", true, model.PermissionLevelAdmin)
			setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)},
				{FieldID: other.ID, Value: json.RawMessage(`"BETA"`)},
			})
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			require.Len(t, res.ValuesToWrite, 1)
			assert.Equal(t, other.ID, res.ValuesToWrite[0].FieldID)
		})

		t.Run("a sent empty or whitespace value leaves the field missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			for _, value := range []string{`""`, `"   "`, `null`} {
				res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
					{FieldID: field.ID, Value: json.RawMessage(value)},
				})
				require.NoError(t, appErr, value)
				assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing), value)
			}
		})

		t.Run("an archived channel is resolved like an active one", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			require.Nil(t, th.App.DeleteChannel(th.Context, channel, admin.Id))
			archived, appErr := th.App.GetChannel(th.Context, channel.Id)
			require.Nil(t, appErr)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, err := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, archived, false, nil)
			require.NoError(t, err)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("a channel that takes no attributes resolves to nothing, and refuses values", func(t *testing.T) {
			th, _, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			direct := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeDirect}
			ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

			res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, direct, false, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)

			_, appErr = th.App.resolveRequiredChannelAttributes(ctx, admin.Id, direct, false, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"x"`)},
			})
			requireResolveError(t, appErr, "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
		})
	})

	t.Run("pending channel", func(t *testing.T) {
		newPending := func(t *testing.T) (*TestHelper, *model.Channel, *model.User) {
			t.Helper()
			th := setupMissingAttributes(t)
			_, user := newAttributesTeamAndMember(t, th)
			return th, &model.Channel{Type: model.ChannelTypeGroup}, user
		}

		t.Run("a required field a person can't write is skipped, not missing", func(t *testing.T) {
			th, channel, user := newPending(t)
			protected := createMissingAttributesField(t, th, "Protected", true, model.PermissionLevelMember)
			protectField(t, th, protected)
			member := createMissingAttributesField(t, th, "Member", true, model.PermissionLevelMember)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.Equal(t, []string{member.ID}, fieldIDsOf(res.Missing))
			assert.Equal(t, []string{protected.ID}, fieldIDsOf(res.Skipped))
		})

		t.Run("every settable required field is missing, whatever the stored values", func(t *testing.T) {
			th, channel, user := newPending(t)
			member := createMissingAttributesField(t, th, "Member", true, model.PermissionLevelMember)
			admin := createMissingAttributesField(t, th, "Admin", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.ElementsMatch(t, []string{member.ID, admin.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
		})

		t.Run("a system admin level field is skipped unless the person has manage_system", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Sysadmin only", true, model.PermissionLevelSysadmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))

			res, appErr = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemAdminRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
		})

		t.Run("a field no one can set is skipped", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Nobody", true, model.PermissionLevelNone)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))
		})

		t.Run("a field with no editor is skipped, never missing", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeDate, "Date", true, model.PermissionLevelMember)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))
		})

		t.Run("sent values are not asked for again", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)},
			})
			require.NoError(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
			require.Len(t, res.ValuesToWrite, 1)
			assert.Equal(t, field.ID, res.ValuesToWrite[0].FieldID)
		})

		t.Run("a value for a field a person can't write is refused up front", func(t *testing.T) {
			th, channel, user := newPending(t)
			protected := createMissingAttributesField(t, th, "Protected", true, model.PermissionLevelMember)
			protectField(t, th, protected)

			_, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, []model.PropertyValuePatchItem{
				{FieldID: protected.ID, Value: json.RawMessage(`"ALPHA"`)},
			})
			requireResolveError(t, appErr, "api.channel.create_channel.attribute_no_permission.app_error", http.StatusForbidden)
		})

		t.Run("a whitespace-only text value is still missing", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"   "`)},
			})
			require.NoError(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})
	})

	t.Run("sent values are validated like channel creation validates them", func(t *testing.T) {
		for _, pending := range []bool{false, true} {
			name := "existing channel"
			if pending {
				name = "pending channel"
			}
			t.Run(name, func(t *testing.T) {
				th, channel, admin, _ := newExisting(t)
				if pending {
					channel = &model.Channel{Type: model.ChannelTypeGroup}
				}
				ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)
				field := createMissingAttributesField(t, th, "Program", false, model.PermissionLevelAdmin)
				noOne := createMissingAttributesField(t, th, "Nobody", false, model.PermissionLevelNone)
				resolve := func(items ...model.PropertyValuePatchItem) error {
					_, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, pending, items)
					return appErr
				}
				value := json.RawMessage(`"x"`)

				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: "not-an-id", Value: value}),
					"api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: model.NewId(), Value: value}),
					"api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(
					model.PropertyValuePatchItem{FieldID: field.ID, Value: value},
					model.PropertyValuePatchItem{FieldID: field.ID, Value: value},
				), "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: noOne.ID, Value: value}),
					"api.channel.create_channel.attribute_no_permission.app_error", http.StatusForbidden)
				assert.NoError(t, resolve(model.PropertyValuePatchItem{FieldID: field.ID, Value: value}))
			})
		}
	})

	t.Run("a field whose own feature is off is refused", func(t *testing.T) {
		th, channel, admin, _ := newExisting(t)
		group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)

		template, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:    group.ID,
			Name:       "classification",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		})
		require.NoError(t, err)
		classification, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:       group.ID,
			Name:          "classification",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		})
		require.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ClassificationMarkings = false })
		_, err = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: classification.ID, Value: json.RawMessage(`"x"`)},
		})
		requireResolveError(t, err, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
	})

	t.Run("with required attributes off", func(t *testing.T) {
		items := []model.PropertyValuePatchItem{{FieldID: model.NewId(), Value: json.RawMessage(`"x"`)}}
		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}

		for name, setup := range map[string]func(t *testing.T) *TestHelper{
			"flag off": func(t *testing.T) *TestHelper {
				// The mock store has no expectations beyond start-up, so any query fails the test.
				th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
					cfg.FeatureFlags.ChannelAttributes = true
					cfg.FeatureFlags.ChannelAttributesRequired = false
				})
				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
				return th
			},
			"license below Enterprise Advanced": func(t *testing.T) *TestHelper {
				th := SetupConfigWithStoreMock(t, setupMissingAttributesConfig)
				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
				return th
			},
			"no license": func(t *testing.T) *TestHelper {
				return SetupConfigWithStoreMock(t, setupMissingAttributesConfig)
			},
		} {
			t.Run(name+" without values returns nothing and runs no query", func(t *testing.T) {
				th := setup(t)
				for _, pending := range []bool{false, true} {
					res, appErr := th.App.resolveRequiredChannelAttributes(th.Context, model.NewId(), channel, pending, nil)
					require.NoError(t, appErr)
					require.NotNil(t, res)
					assert.Empty(t, res.ValuesToWrite)
					assert.Empty(t, res.Missing)
					assert.Empty(t, res.Skipped)
				}
			})

			t.Run(name+" with values is refused as creation refuses them", func(t *testing.T) {
				th := setup(t)
				for _, pending := range []bool{false, true} {
					res, appErr := th.App.resolveRequiredChannelAttributes(th.Context, model.NewId(), channel, pending, items)
					assert.Nil(t, res)
					requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
				}
			})
		}
	})
}

func TestWriteChannelAttributeValues(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("writes the resolved values onto the channel", func(t *testing.T) {
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)},
		})
		require.NoError(t, appErr)
		require.NoError(t, th.App.writeChannelAttributeValues(ctx, channel, admin.Id, res.ValuesToWrite))

		missing, missingErr := th.App.missingRequiredChannelAttributes(th.Context, channel)
		require.NoError(t, missingErr)
		assert.Empty(t, missing)

		stored, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
			GroupID:    field.GroupID,
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channel.Id},
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
		assert.Equal(t, admin.Id, stored[0].CreatedBy)
	})

	t.Run("nothing to write is not an error", func(t *testing.T) {
		th := setupMissingAttributes(t)
		require.NoError(t, th.App.writeChannelAttributeValues(th.Context, th.BasicChannel, th.BasicUser.Id, nil))
	})

	t.Run("a value the hooks refuse is returned", func(t *testing.T) {
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeSelect, "Program", true, model.PermissionLevelAdmin)
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"` + model.NewId() + `"`)},
		})
		require.NoError(t, appErr)
		require.Error(t, th.App.writeChannelAttributeValues(ctx, channel, admin.Id, res.ValuesToWrite))
	})
}

// The tiers that need a session are covered by TestCreateChannelWithPropertyValues.
// This covers the ones that must answer no without consulting one, because on the
// create path this function is the only gate: a field the property API would refuse
// a value for must not become settable by creating a channel.
func TestCanSetChannelAttributeOnPendingChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	member := model.PermissionLevelMember
	admin := model.PermissionLevelAdmin
	none := model.PermissionLevelNone
	unknown := model.PermissionLevel("supervisor")

	t.Run("member and admin are satisfied by creation itself", func(t *testing.T) {
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &member}))
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &admin}))
	})

	t.Run("none is never settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &none}))
	})

	t.Run("an unset tier is not settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{}))
	})

	t.Run("an unrecognised tier is not settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &unknown}))
	})

	sysadmin := model.PermissionLevelSysadmin

	t.Run("sysadmin tier is settable by a caller with manage_system", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{Roles: model.SystemAdminRoleId})
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(rctx, &model.PropertyField{PermissionValues: &sysadmin}))
	})

	t.Run("sysadmin tier is not settable by a caller without manage_system", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{Roles: model.SystemUserRoleId})
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(rctx, &model.PropertyField{PermissionValues: &sysadmin}))
	})
}

func TestConvertGroupMessageToChannelRequiredAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	// newGM returns a group message of th.BasicUser and two other members of
	// th.BasicTeam, and a context for th.BasicUser as a plain team member.
	newGM := func(t *testing.T, th *TestHelper) (*model.Channel, *model.Team, request.CTX) {
		t.Helper()
		other1 := th.CreateUser(t)
		other2 := th.CreateUser(t)
		th.LinkUserToTeam(t, other1, th.BasicTeam)
		th.LinkUserToTeam(t, other2, th.BasicTeam)
		gm := th.CreateGroupChannel(t, other1, other2)
		return gm, th.BasicTeam, requiredAttributesSessionCtx(th, th.BasicUser, model.SystemUserRoleId)
	}

	conversion := func(gm *model.Channel, team *model.Team, items ...model.PropertyValuePatchItem) *model.GroupMessageConversionRequestBody {
		id := model.NewId()
		return &model.GroupMessageConversionRequestBody{
			ChannelID:      gm.Id,
			TeamID:         team.Id,
			Name:           "converted-" + id,
			DisplayName:    "Converted " + id,
			PropertyValues: items,
		}
	}

	memberIDsOf := func(t *testing.T, th *TestHelper, channel *model.Channel) []string {
		t.Helper()
		members, appErr := th.App.GetChannelMembersPage(th.Context, channel.Id, 0, 100)
		require.Nil(t, appErr)
		ids := make([]string, 0, len(members))
		for _, member := range members {
			ids = append(ids, member.UserId)
		}
		return ids
	}

	storedValues := func(t *testing.T, th *TestHelper, field *model.PropertyField, channel *model.Channel) []*model.PropertyValue {
		t.Helper()
		stored, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
			GroupID:    field.GroupID,
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channel.Id},
			PerPage:    10,
		})
		require.NoError(t, err)
		return stored
	}

	conversionPosts := func(t *testing.T, th *TestHelper, channel *model.Channel) int {
		t.Helper()
		postList, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 50}, false, map[string]bool{})
		require.NoError(t, err)
		count := 0
		for _, post := range postList.Posts {
			if post.Type == model.PostTypeGMConvertedToChannel {
				count++
			}
		}
		return count
	}

	inChannelsCategory := func(t *testing.T, th *TestHelper, userID, teamID, channelID string) bool {
		t.Helper()
		categories, appErr := th.App.GetSidebarCategories(th.Context, userID, teamID)
		require.Nil(t, appErr)
		for _, category := range categories.Categories {
			// A group message always shows in the direct messages category.
			if category.Type == model.SidebarCategoryChannels && slices.Contains(category.Channels, channelID) {
				return true
			}
		}
		return false
	}

	requireStillGM := func(t *testing.T, th *TestHelper, original *model.Channel, members []string) {
		t.Helper()
		current, appErr := th.App.GetChannel(th.Context, original.Id)
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypeGroup, current.Type)
		assert.Equal(t, original.TeamId, current.TeamId)
		assert.Equal(t, original.Name, current.Name)
		assert.Equal(t, original.DisplayName, current.DisplayName)
		assert.ElementsMatch(t, members, memberIDsOf(t, th, current))
	}

	t.Run("a required attribute the converter can set and didn't send is refused, and nothing changes", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		members := memberIDsOf(t, th, gm)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team))
		assert.Nil(t, converted)
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)

		requireStillGM(t, th, gm, members)
		member, appErr := th.App.GetChannelMember(th.Context, gm.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, member.SchemeAdmin)
		assert.Zero(t, conversionPosts(t, th, gm))
	})

	t.Run("an empty value for a required attribute is refused like a missing one", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"   "`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)

		current, appErr := th.App.GetChannel(th.Context, gm.Id)
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypeGroup, current.Type)
	})

	t.Run("an invalid value item is refused and nothing changes", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		members := memberIDsOf(t, th, gm)

		_, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
			model.PropertyValuePatchItem{FieldID: model.NewId(), Value: json.RawMessage(`"x"`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)

		requireStillGM(t, th, gm, members)
	})

	t.Run("sent values are stored, the converter becomes channel admin and the sidebar and post follow", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		gm, team, ctx := newGM(t, th)
		// Only a channel admin may write this one, so the write has to follow the promotion.
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, converted.Type)
		assert.Equal(t, team.Id, converted.TeamId)

		current, appErr := th.App.GetChannel(th.Context, gm.Id)
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, current.Type)

		member, appErr := th.App.GetChannelMember(th.Context, gm.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.True(t, member.SchemeAdmin)

		stored := storedValues(t, th, field, current)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
		assert.Equal(t, th.BasicUser.Id, stored[0].CreatedBy)

		assert.Equal(t, 1, conversionPosts(t, th, current))
		assert.True(t, inChannelsCategory(t, th, th.BasicUser.Id, team.Id, gm.Id))
		// The value is already there when the new admin is checked, so nothing is reported missing.
		requireNoMissingAttributesPost(t, th, bot.UserId, th.BasicUser.Id)
	})

	t.Run("a value write that fails leaves a group message, as it was", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		members := memberIDsOf(t, th, gm)
		// An option that doesn't exist passes the checks made up front and is
		// refused by the value hooks, once the channel is already private.
		field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeSelect, "Program", true, model.PermissionLevelAdmin)

		converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"` + model.NewId() + `"`)}))
		assert.Nil(t, converted)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "api.channel.create_channel.missing_required_attributes.app_error", appErr.Id)
		assert.NotEqual(t, "api.channel.create_channel.invalid_attribute.app_error", appErr.Id)

		requireStillGM(t, th, gm, members)
		member, appErr := th.App.GetChannelMember(th.Context, gm.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, member.SchemeAdmin)
		assert.True(t, member.SchemeUser)
		assert.Empty(t, storedValues(t, th, field, gm))
		assert.Zero(t, conversionPosts(t, th, gm))
		assert.False(t, inChannelsCategory(t, th, th.BasicUser.Id, team.Id, gm.Id))
	})

	t.Run("a required attribute a person can't write doesn't stop the conversion", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		field := createMissingAttributesField(t, th, "Protected", true, model.PermissionLevelMember)
		protectField(t, th, field)

		converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team))
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, converted.Type)
		assert.Empty(t, storedValues(t, th, field, converted))
	})

	t.Run("a value for an attribute a person can't write is refused before the conversion", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, ctx := newGM(t, th)
		members := memberIDsOf(t, th, gm)
		field := createMissingAttributesField(t, th, "Protected", true, model.PermissionLevelMember)
		protectField(t, th, field)

		_, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.attribute_no_permission.app_error", http.StatusForbidden)

		requireStillGM(t, th, gm, members)
	})

	t.Run("a required attribute the converter can't set doesn't stop the conversion", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		gm, team, ctx := newGM(t, th)
		field := createMissingAttributesField(t, th, "Sysadmin only", true, model.PermissionLevelSysadmin)

		converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team))
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, converted.Type)

		member, appErr := th.App.GetChannelMember(th.Context, gm.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.True(t, member.SchemeAdmin)
		assert.Empty(t, storedValues(t, th, field, converted))

		// Nor can the new channel admin set it, so there is nothing to message them about.
		requireNoMissingAttributesPost(t, th, bot.UserId, th.BasicUser.Id)
	})

	t.Run("a system admin is asked for a system admin level attribute", func(t *testing.T) {
		th := setupMissingAttributes(t)
		gm, team, _ := newGM(t, th)
		createMissingAttributesField(t, th, "Sysadmin only", true, model.PermissionLevelSysadmin)
		ctx := requiredAttributesSessionCtx(th, th.BasicUser, model.SystemAdminRoleId)

		_, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team))
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
	})

	t.Run("with required attributes off a group message converts as it always did", func(t *testing.T) {
		th := SetupConfig(t, setupMissingAttributesConfig).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		gm, team, ctx := newGM(t, th)
		// A field can only be marked required while enforcement is on, so it is
		// seeded under the flag that a server turns off afterwards.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = true })
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = false })

		t.Run("values are refused as creation refuses them", func(t *testing.T) {
			_, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team,
				model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
			requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)

			current, appErr := th.App.GetChannel(th.Context, gm.Id)
			require.Nil(t, appErr)
			assert.Equal(t, model.ChannelTypeGroup, current.Type)
		})

		t.Run("without values nothing is asked", func(t *testing.T) {
			converted, appErr := th.App.ConvertGroupMessageToChannel(ctx, th.BasicUser.Id, conversion(gm, team))
			require.Nil(t, appErr)
			assert.Equal(t, model.ChannelTypePrivate, converted.Type)

			member, appErr := th.App.GetChannelMember(th.Context, gm.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			assert.True(t, member.SchemeAdmin)
			assert.Equal(t, 1, conversionPosts(t, th, converted))
			assert.True(t, inChannelsCategory(t, th, th.BasicUser.Id, team.Id, gm.Id))
		})
	})

	// A guest can't be made channel admin, so the role step fails after the type change.
	t.Run("a failed role change reverts the conversion only with required attributes on", func(t *testing.T) {
		newGuestGM := func(t *testing.T, th *TestHelper) (*model.Channel, *model.User) {
			t.Helper()
			guest := th.CreateGuest(t)
			th.LinkUserToTeam(t, guest, th.BasicTeam)
			other := th.CreateUser(t)
			th.LinkUserToTeam(t, other, th.BasicTeam)
			gm, appErr := th.App.CreateGroupChannel(th.Context, []string{guest.Id, other.Id, th.BasicUser.Id}, th.BasicUser.Id)
			require.Nil(t, appErr)
			return gm, guest
		}

		t.Run("on", func(t *testing.T) {
			th := setupMissingAttributes(t)
			gm, guest := newGuestGM(t, th)
			members := memberIDsOf(t, th, gm)

			_, appErr := th.App.ConvertGroupMessageToChannel(requiredAttributesSessionCtx(th, guest, model.SystemGuestRoleId), guest.Id, conversion(gm, th.BasicTeam))
			require.NotNil(t, appErr)

			requireStillGM(t, th, gm, members)
			assert.Zero(t, conversionPosts(t, th, gm))
		})

		t.Run("off", func(t *testing.T) {
			th := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.ChannelAttributesRequired = false
			}).InitBasic(t)
			gm, guest := newGuestGM(t, th)

			_, appErr := th.App.ConvertGroupMessageToChannel(requiredAttributesSessionCtx(th, guest, model.SystemGuestRoleId), guest.Id, conversion(gm, th.BasicTeam))
			require.NotNil(t, appErr)

			current, appErr := th.App.GetChannel(th.Context, gm.Id)
			require.Nil(t, appErr)
			assert.Equal(t, model.ChannelTypePrivate, current.Type)
			assert.Equal(t, 1, conversionPosts(t, th, current))
		})
	})
}

func TestUpdateChannelPrivacyRequiredAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	// newPublic returns a helper, a public channel administered by admin and a
	// plain member of it. The channel exists before any field does.
	newPublic := func(t *testing.T) (*TestHelper, *model.Channel, *model.User, *model.User) {
		t.Helper()
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Going private")
		member := th.CreateUser(t)
		th.LinkUserToTeam(t, member, team)
		th.AddUserToChannel(t, member, channel)
		return th, channel, admin, member
	}

	// makePrivate does what the handlers do: carry the new type on the channel.
	makePrivate := func(th *TestHelper, ctx request.CTX, user *model.User, channel *model.Channel, opts UpdateChannelPrivacyOptions) (*model.Channel, *model.AppError) {
		toUpdate, appErr := th.App.GetChannel(th.Context, channel.Id)
		if appErr != nil {
			return nil, appErr
		}
		toUpdate.Type = model.ChannelTypePrivate
		return th.App.UpdateChannelPrivacy(ctx, toUpdate, user, opts)
	}

	storedValues := func(t *testing.T, th *TestHelper, field *model.PropertyField, channel *model.Channel) []*model.PropertyValue {
		t.Helper()
		stored, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
			GroupID:    field.GroupID,
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channel.Id},
			PerPage:    10,
		})
		require.NoError(t, err)
		return stored
	}

	requireType := func(t *testing.T, th *TestHelper, channel *model.Channel, channelType model.ChannelType) {
		t.Helper()
		current, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, channelType, current.Type)
	}

	byPerson := func(items ...model.PropertyValuePatchItem) UpdateChannelPrivacyOptions {
		return UpdateChannelPrivacyOptions{PropertyValues: items, ByPerson: true}
	}

	t.Run("a request to make an already private channel private is not refused for a missing value", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		// Make the channel private first, without asking for values.
		_, appErr := makePrivate(th, ctx, admin, channel, UpdateChannelPrivacyOptions{})
		require.Nil(t, appErr)

		opts := byPerson()
		opts.WasPrivate = true
		_, appErr = makePrivate(th, ctx, admin, channel, opts)
		require.Nil(t, appErr)
		requireType(t, th, channel, model.ChannelTypePrivate)
	})

	t.Run("a required attribute the person can set and didn't send is refused, and the channel stays public", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		updated, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel, byPerson())
		assert.Nil(t, updated)
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
		requireType(t, th, channel, model.ChannelTypeOpen)
		assert.Empty(t, storedValues(t, th, field, channel))
	})

	t.Run("an empty value is refused like a missing one", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"  "`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
		requireType(t, th, channel, model.ChannelTypeOpen)
	})

	t.Run("sent values are stored and the channel becomes private", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		updated, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, updated.Type)
		requireType(t, th, channel, model.ChannelTypePrivate)

		stored := storedValues(t, th, field, channel)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
		assert.Equal(t, admin.Id, stored[0].CreatedBy)
		requireNoMissingAttributesPost(t, th, bot.UserId, admin.Id)
	})

	t.Run("a channel that already has the value is not asked again", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

		_, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel, byPerson())
		require.Nil(t, appErr)
		requireType(t, th, channel, model.ChannelTypePrivate)
	})

	t.Run("an invalid value item is refused and nothing changes", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: model.NewId(), Value: json.RawMessage(`"ALPHA"`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
		requireType(t, th, channel, model.ChannelTypeOpen)
	})

	t.Run("a value write that fails changes nothing", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		// An option that doesn't exist passes the checks made up front and is
		// refused by the value hooks.
		field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeSelect, "Program", true, model.PermissionLevelAdmin)

		updated, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"` + model.NewId() + `"`)}))
		assert.Nil(t, updated)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "api.channel.create_channel.missing_required_attributes.app_error", appErr.Id)
		assert.NotEqual(t, "api.channel.create_channel.invalid_attribute.app_error", appErr.Id)
		requireType(t, th, channel, model.ChannelTypeOpen)
		assert.Empty(t, storedValues(t, th, field, channel))
	})

	t.Run("a required attribute the person can't set doesn't stop the change, and the channel admins are told", func(t *testing.T) {
		th, channel, admin, member := newPublic(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		updated, appErr := makePrivate(th, requiredAttributesSessionCtx(th, member, model.SystemUserRoleId), member, channel, byPerson())
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, updated.Type)
		requireType(t, th, channel, model.ChannelTypePrivate)
		assert.Empty(t, storedValues(t, th, field, channel))

		post := requireOneMissingAttributesPost(t, th, bot.UserId, admin.Id)
		assert.Contains(t, post.Message, "**Program**")
		assert.ElementsMatch(t, []any{channel.Id}, post.GetProp("channel_ids"))
		// The member who made it private can't set the value, so there is nothing to tell them.
		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a plugin or internal caller is not asked and nothing is sent", func(t *testing.T) {
		th, channel, admin, _ := newPublic(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		updated, appErr := makePrivate(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin, channel, UpdateChannelPrivacyOptions{})
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelTypePrivate, updated.Type)
		requireType(t, th, channel, model.ChannelTypePrivate)
		assert.Empty(t, storedValues(t, th, field, channel))
		requireNoMissingAttributesPost(t, th, bot.UserId, admin.Id)
	})

	t.Run("a local admin is asked for what it can set", func(t *testing.T) {
		th, channel, _, _ := newPublic(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		local := th.Context.WithSession(&model.Session{Local: true})

		_, appErr := makePrivate(th, local, nil, channel, byPerson())
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
		requireType(t, th, channel, model.ChannelTypeOpen)

		_, appErr = makePrivate(th, local, nil, channel, byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		require.Nil(t, appErr)
		requireType(t, th, channel, model.ChannelTypePrivate)
		stored := storedValues(t, th, field, channel)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
	})

	t.Run("with required attributes off", func(t *testing.T) {
		th := SetupConfig(t, setupMissingAttributesConfig).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Going private")
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = false })
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		t.Run("values are refused as creation refuses them", func(t *testing.T) {
			_, appErr := makePrivate(th, ctx, admin, channel, byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
			requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
			requireType(t, th, channel, model.ChannelTypeOpen)
		})

		t.Run("without values nothing is asked", func(t *testing.T) {
			updated, appErr := makePrivate(th, ctx, admin, channel, byPerson())
			require.Nil(t, appErr)
			assert.Equal(t, model.ChannelTypePrivate, updated.Type)
			requireType(t, th, channel, model.ChannelTypePrivate)
		})
	})
}

func TestRestoreChannelRequiredAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	// newArchived returns a helper, a channel administered by admin that was
	// archived before any field existed, and a plain member of it.
	newArchived := func(t *testing.T, channelType model.ChannelType) (*TestHelper, *model.Channel, *model.User, *model.User) {
		t.Helper()
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, channelType, "Coming back")
		member := th.CreateUser(t)
		th.LinkUserToTeam(t, member, team)
		th.AddUserToChannel(t, member, channel)
		require.Nil(t, th.App.DeleteChannel(th.Context, channel, admin.Id))
		return th, channel, admin, member
	}

	restore := func(th *TestHelper, ctx request.CTX, userID string, channel *model.Channel, opts RestoreChannelOptions) (*model.Channel, *model.AppError) {
		archived, appErr := th.App.GetChannel(th.Context, channel.Id)
		if appErr != nil {
			return nil, appErr
		}
		return th.App.RestoreChannel(ctx, archived, userID, opts)
	}

	storedValues := func(t *testing.T, th *TestHelper, field *model.PropertyField, channel *model.Channel) []*model.PropertyValue {
		t.Helper()
		stored, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
			GroupID:    field.GroupID,
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channel.Id},
			PerPage:    10,
		})
		require.NoError(t, err)
		return stored
	}

	requireArchived := func(t *testing.T, th *TestHelper, channel *model.Channel, archived bool) {
		t.Helper()
		current, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, archived, current.DeleteAt != 0)
	}

	byPerson := func(items ...model.PropertyValuePatchItem) RestoreChannelOptions {
		return RestoreChannelOptions{PropertyValues: items, ByPerson: true}
	}

	for _, channelType := range []model.ChannelType{model.ChannelTypeOpen, model.ChannelTypePrivate} {
		t.Run("a required attribute the person can set and didn't send is refused, and the "+string(channelType)+" channel stays archived", func(t *testing.T) {
			th, channel, admin, _ := newArchived(t, channelType)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			restored, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, byPerson())
			assert.Nil(t, restored)
			requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
			requireArchived(t, th, channel, true)
			assert.Empty(t, storedValues(t, th, field, channel))
		})
	}

	t.Run("an empty value is refused like a missing one", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"  "`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
		requireArchived(t, th, channel, true)
	})

	t.Run("sent values are stored and the channel is restored", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypePrivate)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		restored, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		require.Nil(t, appErr)
		assert.Zero(t, restored.DeleteAt)
		requireArchived(t, th, channel, false)

		stored := storedValues(t, th, field, channel)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
		assert.Equal(t, admin.Id, stored[0].CreatedBy)
		requireNoMissingAttributesPost(t, th, bot.UserId, admin.Id)
	})

	t.Run("a channel that already has the value is not asked again", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

		_, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, byPerson())
		require.Nil(t, appErr)
		requireArchived(t, th, channel, false)
	})

	t.Run("an unknown field is refused and the channel stays archived", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: model.NewId(), Value: json.RawMessage(`"ALPHA"`)}))
		requireResolveError(t, appErr, "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
		requireArchived(t, th, channel, true)
	})

	t.Run("a value write that fails leaves the channel archived", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		// An option that doesn't exist passes the checks made up front and is
		// refused by the value hooks.
		field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeSelect, "Program", true, model.PermissionLevelAdmin)

		restored, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"` + model.NewId() + `"`)}))
		assert.Nil(t, restored)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "api.channel.create_channel.missing_required_attributes.app_error", appErr.Id)
		assert.NotEqual(t, "api.channel.create_channel.invalid_attribute.app_error", appErr.Id)
		requireArchived(t, th, channel, true)
		assert.Empty(t, storedValues(t, th, field, channel))
	})

	t.Run("a required attribute the person can't set doesn't stop the restore, and the channel admins are told", func(t *testing.T) {
		th, channel, admin, member := newArchived(t, model.ChannelTypeOpen)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		restored, appErr := restore(th, requiredAttributesSessionCtx(th, member, model.SystemUserRoleId), member.Id, channel, byPerson())
		require.Nil(t, appErr)
		assert.Zero(t, restored.DeleteAt)
		requireArchived(t, th, channel, false)
		assert.Empty(t, storedValues(t, th, field, channel))

		post := requireOneMissingAttributesPost(t, th, bot.UserId, admin.Id)
		assert.Contains(t, post.Message, "**Program**")
		assert.ElementsMatch(t, []any{channel.Id}, post.GetProp("channel_ids"))
		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a plugin restore is not asked and nothing is sent", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		restored, appErr := restore(th, th.Context, "", channel, RestoreChannelOptions{})
		require.Nil(t, appErr)
		assert.Zero(t, restored.DeleteAt)
		requireArchived(t, th, channel, false)
		assert.Empty(t, storedValues(t, th, field, channel))
		requireNoMissingAttributesPost(t, th, bot.UserId, admin.Id)
	})

	t.Run("a local admin is asked for what it can set", func(t *testing.T) {
		th, channel, _, _ := newArchived(t, model.ChannelTypeOpen)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		local := th.Context.WithSession(&model.Session{Local: true})

		_, appErr := restore(th, local, "", channel, byPerson())
		requireResolveError(t, appErr, "api.channel.create_channel.missing_required_attributes.app_error", http.StatusBadRequest)
		requireArchived(t, th, channel, true)

		_, appErr = restore(th, local, "", channel, byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		require.Nil(t, appErr)
		requireArchived(t, th, channel, false)
		stored := storedValues(t, th, field, channel)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
	})

	t.Run("a plugin that refuses the restore leaves the channel archived, with the values it was sent", func(t *testing.T) {
		th, channel, admin, _ := newArchived(t, model.ChannelTypeOpen)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
				return "restore not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		restored, appErr := restore(th, requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel,
			byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
		assert.Nil(t, restored)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
		requireArchived(t, th, channel, true)
		assert.Len(t, storedValues(t, th, field, channel), 1)
	})

	t.Run("with required attributes off", func(t *testing.T) {
		th := SetupConfig(t, setupMissingAttributesConfig).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Coming back")
		require.Nil(t, th.App.DeleteChannel(th.Context, channel, admin.Id))
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = false })
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		t.Run("values are refused as creation refuses them", func(t *testing.T) {
			_, appErr := restore(th, ctx, admin.Id, channel, byPerson(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)}))
			requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
			requireArchived(t, th, channel, true)
		})

		t.Run("without values nothing is asked", func(t *testing.T) {
			restored, appErr := restore(th, ctx, admin.Id, channel, byPerson())
			require.Nil(t, appErr)
			assert.Zero(t, restored.DeleteAt)
			requireArchived(t, th, channel, false)
		})
	})
}
