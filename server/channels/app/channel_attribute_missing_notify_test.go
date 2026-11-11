// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func setupMissingAttributesConfig(cfg *model.Config) {
	cfg.FeatureFlags.ChannelAttributes = true
	cfg.FeatureFlags.ChannelAttributesRequired = true
	*cfg.ServiceSettings.PostPriority = false
}

// setupMissingAttributes returns a helper with the required-attribute flags on
// and an Enterprise Advanced license.
func setupMissingAttributes(t *testing.T) *TestHelper {
	t.Helper()
	th := SetupConfig(t, setupMissingAttributesConfig).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	return th
}

// createMissingAttributesField seeds a channel field through the property
// service, because App.CreatePropertyField refuses a field created already
// required while an active channel lacks a value, and these tests are about
// that state.
func createMissingAttributesField(t *testing.T, th *TestHelper, displayName string, required bool, valueWrite model.PermissionLevel) *model.PropertyField {
	t.Helper()
	return createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeText, displayName, required, valueWrite)
}

func createMissingAttributesFieldOfType(t *testing.T, th *TestHelper, fieldType model.PropertyFieldType, displayName string, required bool, valueWrite model.PermissionLevel) *model.PropertyField {
	t.Helper()

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	sysadmin := model.PermissionLevelSysadmin
	field, err := th.App.Srv().PropertyService().CreatePropertyField(th.Context, &model.PropertyField{
		Name:              "f_" + model.NewId(),
		Type:              fieldType,
		GroupID:           group.ID,
		ObjectType:        model.PropertyFieldObjectTypeChannel,
		TargetType:        model.PropertyValueTargetTypeSystem,
		PermissionField:   &sysadmin,
		PermissionValues:  &valueWrite,
		PermissionOptions: &sysadmin,
		Attrs: model.StringInterface{
			model.PropertyFieldAttrDisplayName: displayName,
			model.PropertyFieldAttrRequired:    required,
		},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, field.ID, true, ""))
	})
	return field
}

func newAttributesTeamAndMember(t *testing.T, th *TestHelper) (*model.Team, *model.User) {
	t.Helper()
	team := th.CreateTeam(t)
	user := th.CreateUser(t)
	th.LinkUserToTeam(t, user, team)
	return team, user
}

// administeredChannel creates a channel whose creator, and so channel admin, is
// user. Call it before the required field exists, so creating it sends nothing.
func administeredChannel(t *testing.T, th *TestHelper, team *model.Team, user *model.User, channelType model.ChannelType, displayName string) *model.Channel {
	t.Helper()
	id := model.NewId()
	channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: displayName,
		Name:        "name" + id,
		Type:        channelType,
		TeamId:      team.Id,
		CreatorId:   user.Id,
	}, true)
	require.Nil(t, appErr)
	return channel
}

// missingAttributesPosts returns the posts in the System bot's DM with userID
// that announce missing channel attribute values.
func missingAttributesPosts(t *testing.T, th *TestHelper, botUserID, userID string) []*model.Post {
	t.Helper()
	var posts []*model.Post
	for _, post := range dmPostsFromBotToUser(t, th, botUserID, userID) {
		if post.GetProp("property_field_ids") != nil {
			posts = append(posts, post)
		}
	}
	return posts
}

func requireOneMissingAttributesPost(t *testing.T, th *TestHelper, botUserID, userID string) *model.Post {
	t.Helper()
	require.Eventually(t, func() bool {
		return len(missingAttributesPosts(t, th, botUserID, userID)) == 1
	}, waitTimeout, waitInterval, "the user should receive exactly one message")
	return missingAttributesPosts(t, th, botUserID, userID)[0]
}

func requireNoMissingAttributesPost(t *testing.T, th *TestHelper, botUserID, userID string) {
	t.Helper()
	require.Never(t, func() bool {
		return len(missingAttributesPosts(t, th, botUserID, userID)) > 0
	}, shortWaitTimeout, waitInterval, "the user must not receive a message")
}

func TestMissingRequiredChannelAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("a required field with no value is returned", func(t *testing.T) {
		th := setupMissingAttributes(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		require.Len(t, missing, 1)
		assert.Equal(t, field.ID, missing[0].ID)
	})

	t.Run("a required field with a value is not returned", func(t *testing.T) {
		th := setupMissingAttributes(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, th.BasicChannel.Id, `"ALPHA"`)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		assert.Empty(t, missing)
	})

	t.Run("a whitespace-only text value counts as missing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, th.BasicChannel.Id, `"   "`)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		require.Len(t, missing, 1)
		assert.Equal(t, field.ID, missing[0].ID)
	})

	t.Run("only the fields without a value are returned, in field order", func(t *testing.T) {
		th := setupMissingAttributes(t)
		first := createMissingAttributesField(t, th, "First", true, model.PermissionLevelAdmin)
		set := createMissingAttributesField(t, th, "Set", true, model.PermissionLevelAdmin)
		third := createMissingAttributesField(t, th, "Third", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, set.GroupID, set.ID, th.BasicChannel.Id, `"x"`)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		require.Len(t, missing, 2)
		assert.Equal(t, []string{first.ID, third.ID}, []string{missing[0].ID, missing[1].ID})
	})

	t.Run("an optional field is not returned", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Optional", false, model.PermissionLevelAdmin)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		assert.Empty(t, missing)
	})

	t.Run("a channel that is not an active public or private channel returns nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		for name, channel := range map[string]*model.Channel{
			"archived":      {Id: model.NewId(), Type: model.ChannelTypeOpen, DeleteAt: model.GetMillis()},
			"direct":        {Id: model.NewId(), Type: model.ChannelTypeDirect},
			"group":         {Id: model.NewId(), Type: model.ChannelTypeGroup},
			"open board":    {Id: model.NewId(), Type: model.ChannelTypeOpenBoard},
			"private board": {Id: model.NewId(), Type: model.ChannelTypePrivateBoard},
			"space":         {Id: model.NewId(), Type: model.ChannelTypeSpace},
			"nil":           nil,
		} {
			t.Run(name, func(t *testing.T) {
				missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, channel)
				require.Nil(t, appErr)
				assert.Empty(t, missing)
			})
		}
	})

	t.Run("a private channel is checked like a public one", func(t *testing.T) {
		th := setupMissingAttributes(t)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		private := th.CreatePrivateChannel(t, th.BasicTeam)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, private)
		require.Nil(t, appErr)
		require.Len(t, missing, 1)
		assert.Equal(t, field.ID, missing[0].ID)
	})

	t.Run("classification follows its own flag and license", func(t *testing.T) {
		th := setupMissingAttributes(t)
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
			Attrs:         model.StringInterface{model.PropertyFieldAttrRequired: true},
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		})
		require.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ClassificationMarkings = false })
		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		assert.Empty(t, missing, "classification is unavailable with its flag off")

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ClassificationMarkings = true })
		missing, appErr = th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		require.Len(t, missing, 1)
		assert.Equal(t, classification.ID, missing[0].ID)

		th.App.Srv().SetLicense(nil)
		missing, appErr = th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		assert.Empty(t, missing, "nothing is reported without a license")
	})

	t.Run("a license below Enterprise Advanced returns nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, th.BasicChannel)
		require.Nil(t, appErr)
		assert.Empty(t, missing)
	})

	t.Run("with the flag off nothing is returned and the store is never touched", func(t *testing.T) {
		// The mock store has no expectations beyond start-up, so any query fails the test.
		th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = true
			cfg.FeatureFlags.ChannelAttributesRequired = false
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen})
		require.Nil(t, appErr)
		assert.Empty(t, missing)
	})

	t.Run("with no license nothing is returned and the store is never touched", func(t *testing.T) {
		th := SetupConfigWithStoreMock(t, setupMissingAttributesConfig)

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen})
		require.Nil(t, appErr)
		assert.Empty(t, missing)
	})
}

func TestNotifyNewChannelAdminOfMissingRequiredAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("creating a channel messages the creator", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, creator := newAttributesTeamAndMember(t, th)

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "Sustainment Window",
			Name:        "sustainment-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, creator.Id)
		assert.Equal(t, bot.UserId, post.UserId)
		assert.Contains(t, post.Message, "[Sustainment Window](/"+team.Name+"/channels/"+channel.Name+")")
		assert.Contains(t, post.Message, "("+escapeChannelAttributeMarkdownPlainText(team.DisplayName)+")")
		assert.Contains(t, post.Message, "**Program**")
		assert.Contains(t, post.Message, "Add values")
		assert.ElementsMatch(t, []any{channel.Id}, post.GetProp("channel_ids"))
		assert.ElementsMatch(t, []any{field.ID}, post.GetProp("property_field_ids"))
		assert.NotContains(t, post.Message, channel.Id)
	})

	t.Run("creating a channel without a creator member sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, creator := newAttributesTeamAndMember(t, th)

		_, appErr = th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "No Admin",
			Name:        "no-admin-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, false)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, creator.Id)
	})

	t.Run("creating a channel that gets its values sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, creator := newAttributesTeamAndMember(t, th)

		_, appErr = th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "Complete",
			Name:        "complete-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, true, &model.PropertyValue{GroupID: field.GroupID, FieldID: field.ID, Value: []byte(`"ALPHA"`)})
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, creator.Id)
	})

	t.Run("creating a team messages its creator once for both default channels", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		creator := th.CreateUser(t)

		id := model.NewId()
		team, appErr := th.App.CreateTeamWithUser(th.Context, &model.Team{
			DisplayName: "dn_" + id,
			Name:        "name" + id,
			Type:        model.TeamOpen,
		}, creator.Id)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, creator.Id)
		assert.Contains(t, post.Message, "/"+team.Name+"/channels/town-square")
		assert.Contains(t, post.Message, "/"+team.Name+"/channels/off-topic")
		assert.Contains(t, post.Message, "**Program**")
		assert.Len(t, post.GetProp("channel_ids"), 2)
	})

	t.Run("joining a team as a plain member sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team := th.CreateTeam(t)
		member := th.CreateUser(t)

		th.LinkUserToTeam(t, member, team)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("promoting a member with scheme roles messages them", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, member.Id)
		assert.Contains(t, post.Message, "/"+team.Name+"/channels/"+channel.Name)
		assert.ElementsMatch(t, []any{field.ID}, post.GetProp("property_field_ids"))
	})

	t.Run("promoting a member with roles messages them", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, member.Id)
		assert.Contains(t, post.Message, "/"+team.Name+"/channels/"+channel.Name)
	})

	t.Run("plugins, bulk import and membership sync promote without a message", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		viaRoles := th.CreateChannel(t, team)
		viaSchemeRoles := th.CreateChannel(t, team)
		viaImport := th.CreateChannel(t, team)
		viaSync := th.CreateChannel(t, team)
		control := th.CreateChannel(t, team)
		for _, channel := range []*model.Channel{viaRoles, viaSchemeRoles, viaImport, control} {
			th.AddUserToChannel(t, member, channel)
		}
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		adminRoles := model.ChannelUserRoleId + " " + model.ChannelAdminRoleId

		// The plugin API's role update
		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, viaRoles.Id, member.Id, adminRoles)
		require.Nil(t, appErr)

		// The scheme role update bulk import, membership sync and GM conversion call
		_, appErr = th.App.UpdateChannelMemberSchemeRoles(th.Context, viaSchemeRoles.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		// Bulk import's explicit-role pass
		_, promoted, appErr := th.App.updateChannelMemberRolesInternal(th.Context, viaImport.Id, member.Id, adminRoles, true)
		require.Nil(t, appErr)
		require.True(t, promoted, "sanity check: the import pass must make the member admin")

		// Membership sync adding the member straight in as admin
		current, err := th.App.Srv().Store().Channel().GetAllChannelMemberIdsByChannelId(viaSync.Id)
		require.NoError(t, err)
		appErr = th.App.SetChannelMembers(th.Context, viaSync, append(current, member.Id), map[string]struct{}{member.Id: {}}, th.SystemAdminUser.Id, 10, 0, func(*model.SetChannelMembersResponse) {})
		require.Nil(t, appErr)
		synced, appErr := th.App.GetChannelMember(th.Context, viaSync.Id, member.Id)
		require.Nil(t, appErr)
		require.True(t, synced.SchemeAdmin, "sanity check: the sync must make the member admin")

		// A promotion through the REST path afterwards is the only one announced, so the
		// silence above is not just a slow send.
		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, control.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, member.Id)
		assert.ElementsMatch(t, []any{control.Id}, post.GetProp("channel_ids"))
	})

	t.Run("a member who is already an admin sends nothing again", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateChannelMemberRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("demoting a member sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, false)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a promotion on a channel that already has the value sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a promotion in a private channel messages the member", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreatePrivateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, member.Id)
		assert.Contains(t, post.Message, "/"+team.Name+"/channels/"+channel.Name)
	})

	t.Run("a promotion in an archived channel sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		require.Nil(t, th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id))

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("recipients only hear about the attributes they can set", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Admin Level", true, model.PermissionLevelAdmin)
		createMissingAttributesField(t, th, "Sysadmin Level", true, model.PermissionLevelSysadmin)
		createMissingAttributesField(t, th, "Nobody Level", true, model.PermissionLevelNone)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, member.Id)
		assert.Contains(t, post.Message, "**Admin Level**")
		assert.NotContains(t, post.Message, "Sysadmin Level")
		assert.NotContains(t, post.Message, "Nobody Level")
		assert.Len(t, post.GetProp("property_field_ids"), 1)
	})

	t.Run("a channel admin gets nothing when only sysadmin or none fields are missing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Sysadmin Level", true, model.PermissionLevelSysadmin)
		createMissingAttributesField(t, th, "Nobody Level", true, model.PermissionLevelNone)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a system admin made channel admin hears about sysadmin-level fields", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team := th.CreateTeam(t)
		th.LinkUserToTeam(t, th.SystemAdminUser, team)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, th.SystemAdminUser, channel)
		createMissingAttributesField(t, th, "Sysadmin Level", true, model.PermissionLevelSysadmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, th.SystemAdminUser.Id, false, true, true)
		require.Nil(t, appErr)

		post := requireOneMissingAttributesPost(t, th, bot.UserId, th.SystemAdminUser.Id)
		assert.Contains(t, post.Message, "**Sysadmin Level**")
	})

	t.Run("a scheme that takes manage_channel_roles from channel admins leaves them nothing to set", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, member := newAttributesTeamAndMember(t, th)

		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		scheme := th.SetupTeamScheme(t)
		th.RemovePermissionFromRole(t, model.PermissionManageChannelRoles.Id, scheme.DefaultChannelAdminRole)
		team.SchemeId = &scheme.Id
		_, appErr = th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)

		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		createMissingAttributesField(t, th, "Admin Level", true, model.PermissionLevelAdmin)

		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("creating a channel as a non-system-admin sends nothing for sysadmin-level fields", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Sysadmin Level", true, model.PermissionLevelSysadmin)
		team, creator := newAttributesTeamAndMember(t, th)

		_, appErr = th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "Sysadmin Only",
			Name:        "sysadmin-only-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, creator.Id)
	})

	t.Run("creating a channel in a team whose scheme takes manage_channel_roles from channel admins sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, creator := newAttributesTeamAndMember(t, th)

		require.NoError(t, th.App.SetPhase2PermissionsMigrationStatus(true))
		scheme := th.SetupTeamScheme(t)
		th.RemovePermissionFromRole(t, model.PermissionManageChannelRoles.Id, scheme.DefaultChannelAdminRole)
		team.SchemeId = &scheme.Id
		_, appErr = th.App.UpdateTeamScheme(team)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Admin Level", true, model.PermissionLevelAdmin)

		_, appErr = th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "Scheme Limited",
			Name:        "scheme-limited-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, creator.Id)
	})

	t.Run("no direct channel is created when no channel can be listed", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		// A team that can't be loaded leaves no permalink to give for the channel.
		channel.TeamId = model.NewId()

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		_, err := th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(admin.Id, bot.UserId), false)
		require.Error(t, err, "no direct channel should have been created")
		assert.Empty(t, missingAttributesPosts(t, th, bot.UserId, admin.Id))
	})

	t.Run("team names are escaped so they cannot inject markup", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		team.DisplayName = "[click](https://evil.example) **x**"
		_, appErr = th.App.UpdateTeam(team)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, `(\[click\]\(https://evil.example\) \*\*x\*\*)`)
		assert.NotContains(t, posts[0].Message, "[click](")
		assert.NotContains(t, posts[0].Message, "**x**")
	})

	t.Run("attribute names are escaped so they cannot inject markup", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		createMissingAttributesField(t, th, "[click](https://evil.example) *x*", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, `**\[click\]\(https://evil.example\) \*x\***`)
		assert.NotContains(t, posts[0].Message, "[click](")
	})

	t.Run("attributes with no editor are left out", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		withEditor := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "With Editor")
		program := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeDate, "Review Date", true, model.PermissionLevelAdmin)
		createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeUser, "Owner", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{withEditor})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, "**Program**")
		assert.NotContains(t, posts[0].Message, "Review Date")
		assert.NotContains(t, posts[0].Message, "Owner")
		assert.ElementsMatch(t, []any{program.ID}, posts[0].GetProp("property_field_ids"))
	})

	t.Run("a channel missing only attributes with no editor sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeDate, "Review Date", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		assert.Empty(t, missingAttributesPosts(t, th, bot.UserId, admin.Id))
	})

	t.Run("one message lists every channel that still misses something", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		otherTeam := th.CreateTeam(t)
		th.LinkUserToTeam(t, admin, otherTeam)
		first := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "First")
		second := administeredChannel(t, th, otherTeam, admin, model.ChannelTypePrivate, "Second")
		complete := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Complete")
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		setChannelPropertyValue(t, th, field.GroupID, field.ID, complete.Id, `"ALPHA"`)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{first, second, complete})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, "/"+team.Name+"/channels/"+first.Name)
		assert.Contains(t, posts[0].Message, "/"+otherTeam.Name+"/channels/"+second.Name)
		assert.Contains(t, posts[0].Message, "("+escapeChannelAttributeMarkdownPlainText(otherTeam.DisplayName)+")")
		assert.NotContains(t, posts[0].Message, complete.Name)
		assert.ElementsMatch(t, []any{first.Id, second.Id}, posts[0].GetProp("channel_ids"))
	})

	t.Run("a long list collapses into an and-more line", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)

		var channels []*model.Channel
		for range channelAttributeNotifyChannelsPerDM + 2 {
			channels = append(channels, administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel"))
		}
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, channels)

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Equal(t, channelAttributeNotifyChannelsPerDM, strings.Count(posts[0].Message, "needs:"))
		assert.Contains(t, posts[0].Message, "and 2 more channels")
		assert.Len(t, posts[0].GetProp("channel_ids"), channelAttributeNotifyChannelsPerDM+2)
	})

	t.Run("channel names are escaped so they cannot redirect the link", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Safe](https://evil.example)[x")
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, `[Safe\](https://evil.example)\[x](/`+team.Name+"/channels/"+channel.Name+")")
	})

	t.Run("a locale without translations falls back to English", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		admin.Locale = "es"
		admin, appErr = th.App.UpdateUser(th.Context, admin, false)
		require.Nil(t, appErr)
		require.Equal(t, "es", admin.Locale)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

		posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
		require.Len(t, posts, 1)
		assert.Contains(t, posts[0].Message, "Channel attribute values are missing in:")
		assert.NotContains(t, posts[0].Message, "app.channel_attributes")
	})

	t.Run("a background context with no caller still works", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		// The test helper fails the test if any property read ran untagged.
		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(request.EmptyContext(th.App.Log()), admin.Id, []*model.Channel{channel})

		require.Len(t, missingAttributesPosts(t, th, bot.UserId, admin.Id), 1)
	})

	t.Run("bots and deactivated users are skipped", func(t *testing.T) {
		th := setupMissingAttributes(t)
		systemBot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		bot := th.CreateBot(t)
		deactivated := th.CreateUser(t)
		th.LinkUserToTeam(t, deactivated, team)
		_, appErr = th.App.UpdateActive(th.Context, deactivated, false)
		require.Nil(t, appErr)

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, bot.UserId, []*model.Channel{channel})
		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, deactivated.Id, []*model.Channel{channel})

		assert.Empty(t, missingAttributesPosts(t, th, systemBot.UserId, bot.UserId))
		assert.Empty(t, missingAttributesPosts(t, th, systemBot.UserId, deactivated.Id))
	})

	t.Run("an unknown user sends nothing", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

		assert.NotPanics(t, func() {
			th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, model.NewId(), []*model.Channel{th.BasicChannel})
		})
	})

	for _, priorityOn := range []bool{false, true} {
		t.Run("the message priority follows post priority being "+map[bool]string{false: "off", true: "on"}[priorityOn], func(t *testing.T) {
			th := setupMissingAttributes(t)
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.PostPriority = priorityOn })
			bot, appErr := th.App.GetSystemBot(th.Context)
			require.Nil(t, appErr)
			team, admin := newAttributesTeamAndMember(t, th)
			channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Channel")
			createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, admin.Id, []*model.Channel{channel})

			posts := missingAttributesPosts(t, th, bot.UserId, admin.Id)
			require.Len(t, posts, 1)
			priority, appErr := th.App.GetPriorityForPost(posts[0].Id)
			require.Nil(t, appErr)
			if !priorityOn {
				assert.Nil(t, priority)
				return
			}
			require.NotNil(t, priority)
			require.NotNil(t, priority.Priority)
			assert.Equal(t, model.PostPriorityUrgent, *priority.Priority)
			assert.Nil(t, priority.RequestedAck)
			assert.Nil(t, priority.PersistentNotifications)
		})
	}

	t.Run("with the flag off nothing is sent and the store is never touched", func(t *testing.T) {
		// The mock store has no expectations beyond start-up, so any query, and
		// any goroutine that ran one, fails the test.
		th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = true
			cfg.FeatureFlags.ChannelAttributesRequired = false
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, model.NewId(), []*model.Channel{channel})
		th.App.queueNewChannelAdminMissingAttributesNotice(th.Context, model.NewId(), channel)
		th.App.queueNewChannelAdminMissingAttributesNoticeByID(th.Context, model.NewId(), channel.Id)
	})

	t.Run("with a license below Enterprise Advanced nothing is sent", func(t *testing.T) {
		th := setupMissingAttributes(t)
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, member.Id, []*model.Channel{channel})
		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		requireNoMissingAttributesPost(t, th, bot.UserId, member.Id)
	})

	t.Run("a failing System bot does not fail the trigger", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, creator := newAttributesTeamAndMember(t, th)

		// The System bot is owned by a system admin; with none, looking it up fails.
		// The app layer refuses to demote the last one, so the role goes through SQL.
		_, err := th.SQLStore.GetMaster().Exec("UPDATE Users SET Roles = ? WHERE Id = ?", model.SystemUserRoleId, th.SystemAdminUser.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(th.SystemAdminUser.Id)
		_, botErr := th.App.GetSystemBot(th.Context)
		require.NotNil(t, botErr, "sanity check: the System bot must be unavailable")

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			DisplayName: "Still Created",
			Name:        "still-created-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      team.Id,
			CreatorId:   creator.Id,
		}, true)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		member := th.CreateUser(t)
		th.LinkUserToTeam(t, member, team)
		th.AddUserToChannel(t, member, channel)
		_, appErr = th.App.UpdateChannelMemberSchemeRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, false, true, true)
		require.Nil(t, appErr)

		assert.NotPanics(t, func() {
			th.App.NotifyNewChannelAdminOfMissingRequiredAttributes(th.Context, creator.Id, []*model.Channel{channel})
		})
	})

	t.Run("a failing System bot does not fail the team creation or role update triggers", func(t *testing.T) {
		th := setupMissingAttributes(t)
		createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		team, member := newAttributesTeamAndMember(t, th)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, member, channel)
		creator := th.CreateUser(t)

		// The System bot is owned by a system admin; with none, looking it up fails.
		_, err := th.SQLStore.GetMaster().Exec("UPDATE Users SET Roles = ? WHERE Id = ?", model.SystemUserRoleId, th.SystemAdminUser.Id)
		require.NoError(t, err)
		th.App.InvalidateCacheForUser(th.SystemAdminUser.Id)
		_, botErr := th.App.GetSystemBot(th.Context)
		require.NotNil(t, botErr, "sanity check: the System bot must be unavailable")

		id := model.NewId()
		createdTeam, appErr := th.App.CreateTeamWithUser(th.Context, &model.Team{
			DisplayName: "dn_" + id,
			Name:        "name" + id,
			Type:        model.TeamOpen,
		}, creator.Id)
		require.Nil(t, appErr)
		require.NotNil(t, createdTeam)

		_, appErr = th.App.UpdateChannelMemberRolesAndNotifyNewAdmin(th.Context, channel.Id, member.Id, model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)
	})
}
