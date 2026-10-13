// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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

// prepare re-fetches the post so metadata is built from scratch, as a real request would.
func (th *propertyValuesTestHelper) prepare(t *testing.T, post *model.Post, groupID string) *model.Post {
	t.Helper()
	fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
	require.Nil(t, appErr)
	fresh.Metadata = nil
	return th.App.PreparePostForClient(th.Context, fresh, &model.PreparePostForClientOpts{PropertyGroupID: groupID})
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

		// Absent group means no lookup and no values, and crucially no unavailability marker:
		// the client must not read "not requested" as "failed to load".
		plain := th.prepare(t, post, "")
		assert.Empty(t, plain.Metadata.PropertyValues)
		assert.False(t, plain.Metadata.PropertyValuesUnavailable)
	})

	t.Run("success with no values leaves the unavailable flag absent", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "sensitivity")
		post := th.post(t, th.BasicChannel)

		hydrated := th.prepare(t, post, th.groupID)
		assert.Empty(t, hydrated.Metadata.PropertyValues)
		assert.False(t, hydrated.Metadata.PropertyValuesUnavailable)

		// omitempty must keep both keys off the wire entirely.
		raw, err := json.Marshal(hydrated.Metadata)
		require.NoError(t, err)
		var decoded map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(raw, &decoded))
		assert.NotContains(t, decoded, "property_values")
		assert.NotContains(t, decoded, "property_values_unavailable")
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
		assert.False(t, hydrated.Metadata.PropertyValuesUnavailable)
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
			// Not an unavailability either: the values were withheld, not unloadable.
			assert.False(t, hydrated.Metadata.PropertyValuesUnavailable)
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
		field, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:    th.groupID,
			Name:       "attr-" + strconv.Itoa(i),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelID,
		})
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
		assert.True(t, hydrated.Metadata.PropertyValuesUnavailable)
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
		assert.False(t, hydrated.Metadata.PropertyValuesUnavailable)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, fields[0].ID, hydrated.Metadata.PropertyValues[0].FieldID)
	})
}
