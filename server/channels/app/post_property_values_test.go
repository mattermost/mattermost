// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type propertyValuesTestHelper struct {
	*TestHelper
	groupID string
}

func setupPropertyValuesTest(t *testing.T) *propertyValuesTestHelper {
	t.Helper()
	th := Setup(t).InitBasic(t)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.PostAttributesPropertyGroupName)
	require.Nil(t, appErr)

	return &propertyValuesTestHelper{TestHelper: th, groupID: group.ID}
}

// createField registers a post-object field at the given target. targetID is empty for system.
func (th *propertyValuesTestHelper) createField(t *testing.T, targetType, targetID, name string) *model.PropertyField {
	t.Helper()
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    th.groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: targetType,
		TargetID:   targetID,
	}, false, "")
	require.Nil(t, appErr)
	return field
}

func (th *propertyValuesTestHelper) setValue(t *testing.T, post *model.Post, field *model.PropertyField, raw string) {
	t.Helper()
	_, appErr := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
		TargetID:   post.Id,
		TargetType: model.PropertyValueTargetTypePost,
		GroupID:    th.groupID,
		FieldID:    field.ID,
		Value:      json.RawMessage(raw),
		CreatedBy:  th.BasicUser.Id,
		UpdatedBy:  th.BasicUser.Id,
	}}, model.PropertyValueTargetTypePost, post.Id, "")
	require.Nil(t, appErr)
}

func (th *propertyValuesTestHelper) post(t *testing.T, channel *model.Channel) *model.Post {
	t.Helper()
	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId: channel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "post " + model.NewId(),
	}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	return post
}

// prepare re-fetches the post so metadata is built from scratch, as a real request from
// BasicUser would. The viewer matters: value reads are gated per caller.
func (th *propertyValuesTestHelper) prepare(t *testing.T, post *model.Post, groupID string) *model.Post {
	t.Helper()
	fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
	require.Nil(t, appErr)
	fresh.Metadata = nil
	viewer := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Roles: model.SystemUserRoleId})
	return th.App.PreparePostForClient(viewer, fresh, &model.PreparePostForClientOpts{PropertyGroupID: groupID})
}

func valueFieldIDs(post *model.Post) []string {
	ids := make([]string, 0, len(post.Metadata.PropertyValues))
	for _, v := range post.Metadata.PropertyValues {
		ids = append(ids, v.FieldID)
	}
	return ids
}

func TestHydratePropertyValues(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("attaches values only when a group is requested", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		field := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, field, `"confidential"`)

		hydrated := th.prepare(t, post, th.groupID)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, hydrated.Metadata.PropertyValues[0].FieldID)
		assert.JSONEq(t, `"confidential"`, string(hydrated.Metadata.PropertyValues[0].Value))
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)

		// Absent group means no lookup and no values, and crucially no unavailability marker:
		// the client must not read "not requested" as "failed to load". Nil rather than false,
		// so the client also keeps whatever it stored from an earlier hydrated response.
		plain := th.prepare(t, post, "")
		assert.Empty(t, plain.Metadata.PropertyValues)
		assert.Nil(t, plain.Metadata.PropertyValuesUnavailable)
	})

	t.Run("success with no values sends the unavailable flag as false", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)

		hydrated := th.prepare(t, post, th.groupID)
		assert.Empty(t, hydrated.Metadata.PropertyValues)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)

		// No values keeps that key off the wire, but the flag is sent so a client that stored
		// true from an earlier failed lookup clears it.
		raw, err := json.Marshal(hydrated.Metadata)
		require.NoError(t, err)
		var decoded map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(raw, &decoded))
		assert.NotContains(t, decoded, "property_values")
		require.Contains(t, decoded, "property_values_unavailable")
		assert.JSONEq(t, "false", string(decoded["property_values_unavailable"]))
	})

	t.Run("a channel with no applicable fields sends the unavailable flag as false", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		post := th.post(t, th.BasicChannel)

		hydrated := th.prepare(t, post, th.groupID)
		assert.Empty(t, hydrated.Metadata.PropertyValues)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
	})

	t.Run("applies system, team and channel fields but not another channel's", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		otherChannel := th.CreateChannel(t, th.BasicTeam)

		systemField := th.createField(t, string(model.PropertyFieldTargetLevelSystem), "", "system-attr")
		teamField := th.createField(t, string(model.PropertyFieldTargetLevelTeam), th.BasicTeam.Id, "team-attr")
		channelField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "channel-attr")
		otherField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), otherChannel.Id, "other-attr")

		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, systemField, `"s"`)
		th.setValue(t, post, teamField, `"t"`)
		th.setValue(t, post, channelField, `"c"`)
		// A value for a field scoped to a different channel must be dropped, not returned.
		th.setValue(t, post, otherField, `"x"`)

		hydrated := th.prepare(t, post, th.groupID)
		assert.ElementsMatch(t, []string{systemField.ID, teamField.ID, channelField.ID}, valueFieldIDs(hydrated))
		assert.NotContains(t, valueFieldIDs(hydrated), otherField.ID)
	})

	t.Run("a DM has no team scope", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)

		systemField := th.createField(t, string(model.PropertyFieldTargetLevelSystem), "", "system-attr")
		teamField := th.createField(t, string(model.PropertyFieldTargetLevelTeam), th.BasicTeam.Id, "team-attr")
		dmField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), dm.Id, "dm-attr")

		post := th.post(t, dm)
		th.setValue(t, post, systemField, `"s"`)
		th.setValue(t, post, dmField, `"c"`)
		// No team, so a team-scoped value cannot apply.
		th.setValue(t, post, teamField, `"t"`)

		hydrated := th.prepare(t, post, th.groupID)
		assert.ElementsMatch(t, []string{systemField.ID, dmField.ID}, valueFieldIDs(hydrated))
	})

	t.Run("drops values whose field is deleted or is not a post field", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		liveField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "live")
		deletedField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "doomed")

		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, liveField, `"live"`)
		th.setValue(t, post, deletedField, `"stale"`)

		require.Nil(t, th.App.DeletePropertyField(th.Context, th.groupID, deletedField.ID, false, ""))

		hydrated := th.prepare(t, post, th.groupID)
		assert.Equal(t, []string{liveField.ID}, valueFieldIDs(hydrated))
	})

	t.Run("orders values by field creation time", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		// Names are deliberately reverse-alphabetical relative to creation order.
		first := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "zulu")
		second := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "alpha")

		post := th.post(t, th.BasicChannel)
		// Values written in the opposite order to prove output order tracks the field, not the value.
		th.setValue(t, post, second, `"2"`)
		th.setValue(t, post, first, `"1"`)

		hydrated := th.prepare(t, post, th.groupID)
		require.Len(t, hydrated.Metadata.PropertyValues, 2)
		assert.Equal(t, []string{first.ID, second.ID}, valueFieldIDs(hydrated))
	})

	// A local-mode (mmctl --local) session names no user, so the viewer has to
	// be tagged as the local admin; tagging its empty UserId would have the
	// access control hook refuse the read and the post come back without values.
	t.Run("a local-mode session gets values", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		field := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, field, `"confidential"`)

		fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, appErr)
		fresh.Metadata = nil
		// Untagged, unlike th.Context, so only the session decides the caller.
		viewer := request.EmptyContext(th.App.Log()).WithSession(&model.Session{Local: true})
		hydrated := th.App.PreparePostForClient(viewer, fresh, &model.PreparePostForClientOpts{PropertyGroupID: th.groupID})

		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, hydrated.Metadata.PropertyValues[0].FieldID)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
	})

	t.Run("a deleted post is never hydrated", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		field := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, field, `"confidential"`)

		_, appErr := th.App.DeletePost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, true)
		require.Nil(t, appErr)
		fresh.Metadata = nil
		hydrated := th.App.PreparePostForClient(th.Context, fresh,
			&model.PreparePostForClientOpts{PropertyGroupID: th.groupID, IncludeDeleted: true})

		assert.Empty(t, hydrated.Metadata.PropertyValues)
		assert.Nil(t, hydrated.Metadata.PropertyValuesUnavailable)
	})

	t.Run("values survive sanitization", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		field := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)
		th.setValue(t, post, field, `"confidential"`)

		hydrated := th.prepare(t, post, th.groupID)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)

		sanitized, _, appErr := th.App.SanitizePostMetadataForUser(th.Context, hydrated, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, sanitized.Metadata)
		assert.Len(t, sanitized.Metadata.PropertyValues, 1)
	})
	// An unrevealed burn-on-read post has its metadata blanked for non-authors. Unlike the deleted-post
	// case, that blanking does not return early, so hydration running afterwards would re-attach
	// attribute values to a post whose content is being withheld. The author, who is allowed to see the
	// post, still gets them.
	t.Run("an unrevealed burn-on-read post", func(t *testing.T) {
		th := setupPropertyValuesTest(t)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableBurnOnRead = new(true)
		})

		field := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")

		borPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "burn after reading",
			Type:      model.PostTypeBurnOnRead,
		}
		borPost.AddProp(model.PostPropsExpireAt, model.GetMillis()+int64(10*60*1000))
		post, _, appErr := th.App.CreatePost(th.Context, borPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		th.setValue(t, post, field, `"confidential"`)

		viewer := th.CreateUser(t)
		th.LinkUserToTeam(t, viewer, th.BasicTeam)
		th.AddUserToChannel(t, viewer, th.BasicChannel)

		prepareAs := func(t *testing.T, userID string) *model.Post {
			t.Helper()
			original := th.Context.Session().UserId
			th.Context.Session().UserId = userID
			t.Cleanup(func() { th.Context.Session().UserId = original })

			fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
			require.Nil(t, appErr)
			fresh.Metadata = nil
			return th.App.PreparePostForClient(th.Context, fresh,
				&model.PreparePostForClientOpts{PropertyGroupID: th.groupID})
		}

		t.Run("a non-author gets no values while the post is unrevealed", func(t *testing.T) {
			hydrated := prepareAs(t, viewer.Id)
			require.NotNil(t, hydrated.Metadata)
			assert.Empty(t, hydrated.Metadata.PropertyValues)
			// Not an unavailability either: the values were withheld, not unloadable, and the
			// post is not hydrated at all.
			assert.Nil(t, hydrated.Metadata.PropertyValuesUnavailable)
		})

		t.Run("the author gets values in the same conditions", func(t *testing.T) {
			hydrated := prepareAs(t, th.BasicUser.Id)
			require.NotNil(t, hydrated.Metadata)
			require.Len(t, hydrated.Metadata.PropertyValues, 1)
			assert.Equal(t, field.ID, hydrated.Metadata.PropertyValues[0].FieldID)
		})
	})
}

// createFieldsPastCap writes channel-scoped fields straight to the store. The per-target cap is
// enforced by FieldLimitHook, which the property service runs on create, so the store is the way
// to reach a field count that CreatePropertyField would refuse.
func (th *propertyValuesTestHelper) createFieldsPastCap(t *testing.T, channelID string, n int) []*model.PropertyField {
	t.Helper()
	fields := make([]*model.PropertyField, n)
	for i := range fields {
		field := &model.PropertyField{
			GroupID:    th.groupID,
			Name:       "attr-" + strconv.Itoa(i),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelID,
		}
		field.Permissions = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{ConvertAttrs: false})
		field, err := th.App.Srv().Store().PropertyField().Create(field)
		require.NoError(t, err)
		fields[i] = field
	}
	return fields
}

func (th *propertyValuesTestHelper) setValues(t *testing.T, post *model.Post, fields []*model.PropertyField) {
	t.Helper()
	values := make([]*model.PropertyValue, len(fields))
	for i, field := range fields {
		values[i] = &model.PropertyValue{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    th.groupID,
			FieldID:    field.ID,
			Value:      json.RawMessage(`"v"`),
			CreatedBy:  th.BasicUser.Id,
			UpdatedBy:  th.BasicUser.Id,
		}
	}
	_, err := th.App.Srv().Store().PropertyValue().CreateMany(values)
	require.NoError(t, err)
}

// hydrateChannelPropertyValues refuses to hydrate rather than hand back a possibly truncated page,
// once either the applicable fields or the fetched values exceed their bound. Neither bound is
// merely defensive: the field bound is sized for post_attributes (three targets, 50 each) but
// applied to whatever PSAv2 group the caller names, and nothing caps the value count at all.
//
// What matters at each guard is that the caller still gets its posts, marked "attributes unknown"
// rather than silently carrying none.
func TestHydratePropertyValuesBoundGuards(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("more applicable fields than the bound", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		post := th.post(t, th.BasicChannel)
		th.createFieldsPastCap(t, th.BasicChannel.Id, model.PostAttributesMaxApplicableFields+1)

		hydrated := th.prepare(t, post, th.groupID)

		require.NotNil(t, hydrated.Metadata)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.True(t, *hydrated.Metadata.PropertyValuesUnavailable)
		assert.Empty(t, hydrated.Metadata.PropertyValues)
		// The post itself is unaffected: only its attributes are reported as unloadable.
		assert.Equal(t, post.Message, hydrated.Message)
	})

	// Pins the comparison as strictly greater than the bound. A field count landing exactly on it
	// is the designed maximum, not an overflow.
	t.Run("exactly the field bound still hydrates", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		post := th.post(t, th.BasicChannel)
		fields := th.createFieldsPastCap(t, th.BasicChannel.Id, model.PostAttributesMaxApplicableFields)
		th.setValues(t, post, fields[:1])

		hydrated := th.prepare(t, post, th.groupID)

		require.NotNil(t, hydrated.Metadata)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, fields[0].ID, hydrated.Metadata.PropertyValues[0].FieldID)
	})

	// Channels are hydrated in separate batches, so one channel's failed lookup marks only its own
	// posts. The others still report how their hydration went.
	t.Run("a list spanning channels reports each channel's result", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		healthyChannel := th.CreateChannel(t, th.BasicTeam)
		emptyChannel := th.CreateChannel(t, th.BasicTeam)

		failingPost := th.post(t, th.BasicChannel)
		th.createFieldsPastCap(t, th.BasicChannel.Id, model.PostAttributesMaxApplicableFields+1)

		healthyField := th.createField(t, string(model.PropertyFieldTargetLevelChannel), healthyChannel.Id, "sensitivity")
		healthyPost := th.post(t, healthyChannel)
		th.setValue(t, healthyPost, healthyField, `"confidential"`)

		emptyPost := th.post(t, emptyChannel)

		list := model.NewPostList()
		for _, post := range []*model.Post{failingPost, healthyPost, emptyPost} {
			fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
			require.Nil(t, appErr)
			fresh.Metadata = nil
			list.AddPost(fresh)
			list.AddOrder(fresh.Id)
		}

		prepared := th.App.PreparePostListForClient(th.Context, list,
			&model.PreparePostForClientOpts{PropertyGroupID: th.groupID})

		failing := prepared.Posts[failingPost.Id]
		require.NotNil(t, failing.Metadata.PropertyValuesUnavailable)
		assert.True(t, *failing.Metadata.PropertyValuesUnavailable)
		assert.Empty(t, failing.Metadata.PropertyValues)

		healthy := prepared.Posts[healthyPost.Id]
		require.NotNil(t, healthy.Metadata.PropertyValuesUnavailable)
		assert.False(t, *healthy.Metadata.PropertyValuesUnavailable)
		assert.Equal(t, []string{healthyField.ID}, valueFieldIDs(healthy))

		empty := prepared.Posts[emptyPost.Id]
		require.NotNil(t, empty.Metadata.PropertyValuesUnavailable)
		assert.False(t, *empty.Metadata.PropertyValuesUnavailable)
		assert.Empty(t, empty.Metadata.PropertyValues)
	})
}

func TestCanSetPostPropertyValueOnCreate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// th.BasicUser created th.BasicChannel and so holds SchemeAdmin there.
	// th.BasicUser2 is a plain member, added below.
	plainMember := th.BasicUser2
	_, appErr := th.App.AddUserToChannel(th.Context, plainMember, th.BasicChannel, false)
	require.Nil(t, appErr)

	outsider := th.CreateUser(t)
	th.LinkUserToTeam(t, outsider, th.BasicTeam)

	dm := th.CreateDmChannel(t, plainMember)

	// The field is never read from the store — only its PermissionValues is —
	// so an in-memory field carrying the level under test is the whole input.
	fieldAt := func(level model.PermissionLevel) *model.PropertyField {
		return &model.PropertyField{
			ID:               model.NewId(),
			GroupID:          model.NewId(),
			Name:             "create time " + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypePost,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: model.NewPointer(level),
		}
	}

	noLevel := fieldAt(model.PermissionLevelMember)
	noLevel.PermissionValues = nil

	testCases := []struct {
		name    string
		userID  string
		field   *model.PropertyField
		channel *model.Channel
		want    bool
	}{
		// member is channel membership, via HasPermissionToChannel, so
		// sysadmins cascade through and non-members do not.
		{"member level, channel admin", th.BasicUser.Id, fieldAt(model.PermissionLevelMember), th.BasicChannel, true},
		{"member level, plain member", plainMember.Id, fieldAt(model.PermissionLevelMember), th.BasicChannel, true},
		{"member level, outsider", outsider.Id, fieldAt(model.PermissionLevelMember), th.BasicChannel, false},
		{"member level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevelMember), th.BasicChannel, true},

		// admin is channel-property admin: manage_channel_roles on a normal
		// channel, non-guest participation on a DM.
		{"admin level, channel admin", th.BasicUser.Id, fieldAt(model.PermissionLevelAdmin), th.BasicChannel, true},
		{"admin level, plain member", plainMember.Id, fieldAt(model.PermissionLevelAdmin), th.BasicChannel, false},
		{"admin level, outsider", outsider.Id, fieldAt(model.PermissionLevelAdmin), th.BasicChannel, false},
		{"admin level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevelAdmin), th.BasicChannel, true},
		{"admin level, DM participant", plainMember.Id, fieldAt(model.PermissionLevelAdmin), dm, true},
		{"admin level, non-participant on a DM", outsider.Id, fieldAt(model.PermissionLevelAdmin), dm, false},

		// creator is true for whoever is creating the post — including the
		// outsider row, which every other level denies. The caller is
		// responsible for having established they may post here at all.
		{"creator level, channel admin", th.BasicUser.Id, fieldAt(model.PermissionLevelCreator), th.BasicChannel, true},
		{"creator level, plain member", plainMember.Id, fieldAt(model.PermissionLevelCreator), th.BasicChannel, true},
		{"creator level, outsider", outsider.Id, fieldAt(model.PermissionLevelCreator), th.BasicChannel, true},
		{"creator level, empty user id", "", fieldAt(model.PermissionLevelCreator), th.BasicChannel, true},

		{"sysadmin level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevelSysadmin), th.BasicChannel, true},
		{"sysadmin level, channel admin", th.BasicUser.Id, fieldAt(model.PermissionLevelSysadmin), th.BasicChannel, false},
		{"sysadmin level, plain member", plainMember.Id, fieldAt(model.PermissionLevelSysadmin), th.BasicChannel, false},

		// A field the property API would refuse a value for must not become
		// settable here, so everything that is not a recognised level denies —
		// for the sysadmin too.
		{"none level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevelNone), th.BasicChannel, false},
		{"none level, channel admin", th.BasicUser.Id, fieldAt(model.PermissionLevelNone), th.BasicChannel, false},
		{"unrecognised level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevel("banana")), th.BasicChannel, false},
		{"empty level, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevel("")), th.BasicChannel, false},
		{"no level set, sysadmin", th.SystemAdminUser.Id, noLevel, th.BasicChannel, false},
		{"nil field, sysadmin", th.SystemAdminUser.Id, nil, th.BasicChannel, false},
		{"nil channel, sysadmin", th.SystemAdminUser.Id, fieldAt(model.PermissionLevelCreator), nil, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want,
				th.App.CanSetPostPropertyValueOnCreate(th.Context, tc.userID, tc.field, tc.channel))
		})
	}
}
