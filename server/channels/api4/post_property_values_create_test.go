// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type postPropertyCreateTestHelper struct {
	*TestHelper
	groupID string
}

func setupPostPropertyCreateTest(t *testing.T, flagEnabled bool) *postPropertyCreateTestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostAttributes = flagEnabled
	}).InitBasic(t)

	// config.Store.Set re-applies environment overrides on every write, so MM_FEATUREFLAGS_POSTATTRIBUTES
	// exported in a shell wins over the flag asked for here. Fail on the flag rather than on whatever
	// the first subtest happens to assert.
	require.Equal(t, flagEnabled, th.App.Config().FeatureFlags.PostAttributes,
		"unset MM_FEATUREFLAGS_POSTATTRIBUTES: it overrides the flag this suite configures")

	group, appErr := th.App.GetPropertyGroup(th.Context, model.PostAttributesPropertyGroupName)
	require.Nil(t, appErr)

	return &postPropertyCreateTestHelper{TestHelper: th, groupID: group.ID}
}

// createField makes a post-object field at one scope level.
func (th *postPropertyCreateTestHelper) createField(t *testing.T, level model.PropertyFieldTargetLevel, targetID string, permission model.PermissionLevel) *model.PropertyField {
	t.Helper()
	return th.createFieldOfObjectType(t, model.PropertyFieldObjectTypePost, level, targetID, permission)
}

// createFieldOfObjectType sets PermissionValues explicitly because the nil-fill lives in the
// property API handler rather than in App.CreatePropertyField, and CanSetPostPropertyValueOnCreate
// denies a field whose PermissionValues is nil.
func (th *postPropertyCreateTestHelper) createFieldOfObjectType(t *testing.T, objectType string, level model.PropertyFieldTargetLevel, targetID string, permission model.PermissionLevel) *model.PropertyField {
	t.Helper()

	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:          th.groupID,
		Name:             "f_" + model.NewId(),
		Type:             model.PropertyFieldTypeText,
		ObjectType:       objectType,
		TargetType:       string(level),
		TargetID:         targetID,
		PermissionValues: model.NewPointer(permission),
	}, false, "")
	require.Nil(t, appErr)

	t.Cleanup(func() {
		require.Nil(t, th.App.DeletePropertyField(th.Context, th.groupID, field.ID, true, ""))
	})

	return field
}

// storedValues reads back what was actually written for a post, so a test proves persistence
// rather than only trusting the response body.
func (th *postPropertyCreateTestHelper) storedValues(t *testing.T, postID string) []*model.PropertyValue {
	t.Helper()

	values, appErr := th.App.SearchPropertyValues(th.Context, th.groupID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypePost,
		TargetIDs:  []string{postID},
		PerPage:    model.PostAttributesMaxApplicableFields,
	})
	require.Nil(t, appErr)
	return values
}

// refuseInvalidAttribute posts the given values and requires the request to come back as a bad
// attribute. When the request was about a real field, pass it as offending: the set of attributes a
// server defines is itself sensitive, so no error may name one.
func (th *postPropertyCreateTestHelper) refuseInvalidAttribute(t *testing.T, channelID string, offending *model.PropertyField, values ...*model.PropertyValue) {
	t.Helper()

	_, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(channelID, values...))
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "api.post.create_post.invalid_attribute.app_error")
	if offending != nil {
		require.NotContains(t, err.Error(), offending.Name)
	}
}

// submittedPropertyValue builds the shape a client sends: a full PropertyValue with only FieldID
// and Value filled in.
func submittedPropertyValue(fieldID, raw string) *model.PropertyValue {
	return &model.PropertyValue{FieldID: fieldID, Value: json.RawMessage(raw)}
}

func postWithPropertyValues(channelID string, values ...*model.PropertyValue) *model.Post {
	return &model.Post{
		ChannelId: channelID,
		Message:   "attributes " + model.NewId(),
		Metadata:  &model.PostMetadata{PropertyValues: values},
	}
}

// requirePropertyValues asserts that values holds exactly one entry per field ID in expected, and
// that each value's raw JSON matches what was expected for that field. Checking value content this
// way -- rather than just the set of field IDs -- catches a value written under the wrong field.
func requirePropertyValues(t *testing.T, values []*model.PropertyValue, expected map[string]string) {
	t.Helper()

	require.Len(t, values, len(expected))

	byFieldID := make(map[string]*model.PropertyValue, len(values))
	for _, value := range values {
		byFieldID[value.FieldID] = value
	}

	for fieldID, raw := range expected {
		value, ok := byFieldID[fieldID]
		require.True(t, ok, "no value found for field %s", fieldID)
		assert.JSONEq(t, raw, string(value.Value), "unexpected value for field %s", fieldID)
	}
}

func TestCreatePostWithPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPostPropertyCreateTest(t, true)
	memberLevel := model.PermissionLevelMember

	t.Run("system, team and channel scoped fields all apply to one post", func(t *testing.T) {
		systemField := th.createField(t, model.PropertyFieldTargetLevelSystem, "", memberLevel)
		teamField := th.createField(t, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id, memberLevel)
		channelField := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		expected := map[string]string{
			systemField.ID:  `"sys"`,
			teamField.ID:    `"team"`,
			channelField.ID: `"chan"`,
		}

		created, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(systemField.ID, expected[systemField.ID]),
			submittedPropertyValue(teamField.ID, expected[teamField.ID]),
			submittedPropertyValue(channelField.ID, expected[channelField.ID]),
		))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// The response carries the values: they are attached before PreparePostForClient, so a
		// client does not have to re-read the post it just created.
		require.NotNil(t, created.Metadata)
		requirePropertyValues(t, created.Metadata.PropertyValues, expected)

		stored := th.storedValues(t, created.Id)
		requirePropertyValues(t, stored, expected)

		for _, value := range stored {
			assert.Equal(t, created.Id, value.TargetID)
			assert.Equal(t, model.PropertyValueTargetTypePost, value.TargetType)
			assert.Equal(t, th.groupID, value.GroupID)
			assert.Equal(t, th.BasicUser.Id, value.CreatedBy)
		}
	})

	t.Run("a reply carries values the same way a root post does", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		root, _, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "root " + model.NewId(),
		})
		require.NoError(t, err)

		reply := postWithPropertyValues(th.BasicChannel.Id, submittedPropertyValue(field.ID, `"on a reply"`))
		reply.RootId = root.Id

		created, resp, err := th.Client.CreatePost(context.Background(), reply)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, root.Id, created.RootId)

		stored := th.storedValues(t, created.Id)
		require.Len(t, stored, 1)
		assert.Equal(t, field.ID, stored[0].FieldID)
		assert.JSONEq(t, `"on a reply"`, string(stored[0].Value))
	})

	// A DM and a GM have no team, so the single field search runs with an empty TeamID. System and
	// channel fields still resolve; a team's fields must not leak in. postAttributeValuesForCreate
	// reads nothing off the channel but its ID and TeamID, so both channel types are the same input
	// to it and are checked the same way.
	requireTeamlessScoping := func(t *testing.T, channel *model.Channel) {
		t.Helper()
		require.Empty(t, channel.TeamId)

		systemField := th.createField(t, model.PropertyFieldTargetLevelSystem, "", memberLevel)
		channelField := th.createField(t, model.PropertyFieldTargetLevelChannel, channel.Id, memberLevel)
		teamField := th.createField(t, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id, memberLevel)

		expected := map[string]string{
			systemField.ID:  `"sys"`,
			channelField.ID: `"chan"`,
		}

		created, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(channel.Id,
			submittedPropertyValue(systemField.ID, expected[systemField.ID]),
			submittedPropertyValue(channelField.ID, expected[channelField.ID]),
		))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		requirePropertyValues(t, th.storedValues(t, created.Id), expected)

		th.refuseInvalidAttribute(t, channel.Id, teamField, submittedPropertyValue(teamField.ID, `"team"`))
	}

	t.Run("direct message: system and channel fields apply, a team's does not", func(t *testing.T) {
		requireTeamlessScoping(t, th.CreateDmChannel(t, th.BasicUser2))
	})

	t.Run("group message: system and channel fields apply, a team's does not", func(t *testing.T) {
		gm, appErr := th.App.CreateGroupChannel(th.Context,
			[]string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		requireTeamlessScoping(t, gm)
	})

	// One subtest per server-owned field rather than a loop, so a regression in handling any one
	// of them names itself in the failure output.
	t.Run("server-owned fields set by the client are refused", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		refuse := func(t *testing.T, value *model.PropertyValue) {
			t.Helper()
			th.refuseInvalidAttribute(t, th.BasicChannel.Id, field, value)
		}

		t.Run("id", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.ID = model.NewId()
			refuse(t, value)
		})

		t.Run("group_id", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.GroupID = th.groupID
			refuse(t, value)
		})

		t.Run("target_id", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.TargetID = model.NewId()
			refuse(t, value)
		})

		t.Run("target_type", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.TargetType = model.PropertyValueTargetTypePost
			refuse(t, value)
		})

		t.Run("created_by", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.CreatedBy = th.BasicUser.Id
			refuse(t, value)
		})

		t.Run("updated_by", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.UpdatedBy = th.BasicUser.Id
			refuse(t, value)
		})

		t.Run("create_at", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.CreateAt = model.GetMillis()
			refuse(t, value)
		})

		t.Run("update_at", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.UpdateAt = model.GetMillis()
			refuse(t, value)
		})

		t.Run("delete_at", func(t *testing.T) {
			value := submittedPropertyValue(field.ID, `"x"`)
			value.DeleteAt = model.GetMillis()
			refuse(t, value)
		})
	})

	t.Run("a field scoped to another channel is unknown to this post", func(t *testing.T) {
		otherChannelField := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel2.Id, memberLevel)

		th.refuseInvalidAttribute(t, th.BasicChannel.Id, otherChannelField, submittedPropertyValue(otherChannelField.ID, `"x"`))
	})

	t.Run("a channel-object field is not a post field", func(t *testing.T) {
		channelObjectField := th.createFieldOfObjectType(t, model.PropertyFieldObjectTypeChannel,
			model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		th.refuseInvalidAttribute(t, th.BasicChannel.Id, channelObjectField, submittedPropertyValue(channelObjectField.ID, `"x"`))
	})

	t.Run("the same field twice in one request is refused", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		th.refuseInvalidAttribute(t, th.BasicChannel.Id, field,
			submittedPropertyValue(field.ID, `"first"`),
			submittedPropertyValue(field.ID, `"second"`),
		)
	})

	t.Run("a malformed field id is refused", func(t *testing.T) {
		th.refuseInvalidAttribute(t, th.BasicChannel.Id, nil, submittedPropertyValue("not-an-id", `"x"`))
	})

	t.Run("an empty field id is refused", func(t *testing.T) {
		th.refuseInvalidAttribute(t, th.BasicChannel.Id, nil, submittedPropertyValue("", `"x"`))
	})

	t.Run("a well-formed but nonexistent field id is refused", func(t *testing.T) {
		th.refuseInvalidAttribute(t, th.BasicChannel.Id, nil, submittedPropertyValue(model.NewId(), `"x"`))
	})

	// Refused before the post is saved: a refusal after the save would remove the post again and
	// hard-delete its attachments, leaving the client to retry with file ids that no longer exist.
	t.Run("a value that doesn't fit its field's type is refused and the attachment survives", func(t *testing.T) {
		numberField, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:          th.groupID,
			Name:             "f_" + model.NewId(),
			Type:             model.PropertyFieldTypeNumber,
			ObjectType:       model.PropertyFieldObjectTypePost,
			TargetType:       string(model.PropertyFieldTargetLevelChannel),
			TargetID:         th.BasicChannel.Id,
			PermissionValues: model.NewPointer(memberLevel),
		}, false, "")
		require.Nil(t, appErr)
		t.Cleanup(func() {
			require.Nil(t, th.App.DeletePropertyField(th.Context, th.groupID, numberField.ID, true, ""))
		})

		fileResp, _, err := th.Client.UploadFile(context.Background(), []byte("data"), th.BasicChannel.Id, "attachment.txt")
		require.NoError(t, err)
		require.Len(t, fileResp.FileInfos, 1)
		fileID := fileResp.FileInfos[0].Id

		post := postWithPropertyValues(th.BasicChannel.Id, submittedPropertyValue(numberField.ID, `"not a number"`))
		post.FileIds = model.StringArray{fileID}
		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.post.create_post.invalid_attribute.app_error")
		require.NotContains(t, err.Error(), numberField.Name)

		info, appErr := th.App.GetFileInfo(th.Context, fileID)
		require.Nil(t, appErr)
		assert.Empty(t, info.PostId, "the file was never attached to a post")
		assert.Zero(t, info.DeleteAt)
	})

	t.Run("a sysadmin-level field is refused for a member and accepted for a sysadmin", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, model.PermissionLevelSysadmin)

		_, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(field.ID, `"classified"`),
		))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.post.create_post.attribute_no_permission.app_error")

		th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(t, th.SystemAdminUser, th.BasicChannel)

		created, resp, err := th.SystemAdminClient.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(field.ID, `"classified"`),
		))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		stored := th.storedValues(t, created.Id)
		require.Len(t, stored, 1)
		assert.Equal(t, field.ID, stored[0].FieldID)
		assert.Equal(t, th.SystemAdminUser.Id, stored[0].CreatedBy)
	})

	// The author of a post being created is always themselves, so the creator level resolves for
	// any member who may post in the channel.
	t.Run("a creator-level field is accepted from an ordinary member", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, model.PermissionLevelCreator)

		created, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(field.ID, `"mine"`),
		))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		stored := th.storedValues(t, created.Id)
		require.Len(t, stored, 1)
		assert.Equal(t, field.ID, stored[0].FieldID)
	})

	t.Run("an everyone-level field is accepted from an ordinary member", func(t *testing.T) {
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, model.PermissionLevelEveryone)

		created, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(field.ID, `"open"`),
		))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		stored := th.storedValues(t, created.Id)
		require.Len(t, stored, 1)
		assert.Equal(t, field.ID, stored[0].FieldID)
	})

	t.Run("a post with no metadata stores no property values", func(t *testing.T) {
		// A field exists for this channel, so a stored value would mean createPost looked it up
		// despite the request submitting nothing.
		th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, memberLevel)

		created, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "no attributes " + model.NewId(),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Empty(t, th.storedValues(t, created.Id))
	})

	// Same branch as above, reached with metadata present, which is what makes GetPropertyValues'
	// nil handling irrelevant here.
	t.Run("an empty values array is accepted the same way as no metadata", func(t *testing.T) {
		created, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Empty(t, th.storedValues(t, created.Id))
	})
}

func TestCreatePostWithPropertyValuesFeatureFlagOff(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPostPropertyCreateTest(t, false)

	t.Run("submitting values is refused", func(t *testing.T) {
		// The field exists and would be applicable with the flag on, so the refusal is the flag's
		// doing and not a lookup that failed to find it.
		field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, model.PermissionLevelMember)

		_, resp, err := th.Client.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
			submittedPropertyValue(field.ID, `"x"`),
		))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.post.create_post.attributes_feature_disabled.app_error")
	})

	t.Run("a post with no values is created normally", func(t *testing.T) {
		_, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "flag off " + model.NewId(),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})
}

func TestCreatePostWithPropertyValuesAsGuest(t *testing.T) {
	mainHelper.Parallel(t)

	// Its own helper rather than a subtest of the suite above: guest accounts need a license, and
	// that suite doesn't set one.
	th := setupPostPropertyCreateTest(t, true)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.GuestAccountsSettings.Enable = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	guest, guestClient := th.CreateGuestAndClient(t)

	// The member level resolves through read_channel, which a guest in the channel has.
	field := th.createField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id, model.PermissionLevelMember)

	created, resp, err := guestClient.CreatePost(context.Background(), postWithPropertyValues(th.BasicChannel.Id,
		submittedPropertyValue(field.ID, `"from a guest"`),
	))
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	stored := th.storedValues(t, created.Id)
	require.Len(t, stored, 1)
	assert.Equal(t, field.ID, stored[0].FieldID)
	assert.Equal(t, guest.Id, stored[0].CreatedBy)
}
