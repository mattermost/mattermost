// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type propertyValuesTestHelper struct {
	*TestHelper
	groupID string
}

func setupPropertyValuesTest(t *testing.T) *propertyValuesTestHelper {
	t.Helper()
	return newPropertyValuesTestHelper(t, Setup(t).InitBasic(t))
}

// setupPropertyValuesCreateTest is setupPropertyValuesTest with the PostAttributes flag set as
// asked: CreatePost refuses values while the flag is off.
func setupPropertyValuesCreateTest(t *testing.T, flagEnabled bool) *propertyValuesTestHelper {
	t.Helper()
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostAttributes = flagEnabled
	}).InitBasic(t)

	// config.Store.Set re-applies environment overrides on every write, so MM_FEATUREFLAGS_POSTATTRIBUTES
	// exported in a shell wins over the flag asked for here.
	require.Equal(t, flagEnabled, th.App.Config().FeatureFlags.PostAttributes,
		"unset MM_FEATUREFLAGS_POSTATTRIBUTES: it overrides the flag this test configures")

	return newPropertyValuesTestHelper(t, th)
}

func newPropertyValuesTestHelper(t *testing.T, th *TestHelper) *propertyValuesTestHelper {
	t.Helper()
	// Post fields live in access_control, which requires an Enterprise licence.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	return &propertyValuesTestHelper{TestHelper: th, groupID: group.ID}
}

// createField registers a system-scoped post-object field.
func (th *propertyValuesTestHelper) createField(t *testing.T, name string) *model.PropertyField {
	t.Helper()
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    th.groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)
	return field
}

// createOtherGroup registers a V2 group with no access_control hooks, so it has no field cap.
func (th *propertyValuesTestHelper) createOtherGroup(t *testing.T) string {
	t.Helper()
	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
		Name:    "post_values_test_" + model.NewId(),
		Version: model.PropertyGroupVersionV2,
	})
	require.Nil(t, appErr)
	return group.ID
}

// createOtherGroupField registers a system-scoped post-object field in a group of its own, so it is
// not one of the fields a post's values may name.
func (th *propertyValuesTestHelper) createOtherGroupField(t *testing.T) *model.PropertyField {
	t.Helper()
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    th.createOtherGroup(t),
		Name:       "f_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
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
		field := th.createField(t, "sensitivity")
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
		th.createField(t, "sensitivity")
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

	t.Run("drops values whose field is deleted or is not a post field", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		liveField := th.createField(t, "live")
		deletedField := th.createField(t, "doomed")

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
		first := th.createField(t, "zulu")
		// CreateAt is millisecond-resolution; same-ms fields fall back to FieldID order.
		for model.GetMillis() <= first.CreateAt {
			time.Sleep(time.Millisecond)
		}
		second := th.createField(t, "alpha")
		require.Greater(t, second.CreateAt, first.CreateAt)

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
		field := th.createField(t, "sensitivity")
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
		field := th.createField(t, "sensitivity")
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
		field := th.createField(t, "sensitivity")
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

		field := th.createField(t, "sensitivity")

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

// maskedPostFixture is a select template that masks its values, a user field linked to it that
// holds each viewer's options, and a system post field linked to the same template, so a post's
// value is visible only to a viewer holding that option.
type maskedPostFixture struct {
	postField *model.PropertyField
	optionA   string
	optionB   string
}

// newMaskedPostFixture builds the fields through the App as a system admin. The fields are linked
// before the template turns masking on, the same order an admin would follow.
func (th *propertyValuesTestHelper) newMaskedPostFixture(t *testing.T, holder *model.User) maskedPostFixture {
	t.Helper()

	admin := th.Context.WithSession(&model.Session{
		UserId: th.SystemAdminUser.Id,
		Roles:  model.SystemAdminRoleId + " " + model.SystemUserRoleId,
	})
	createField := func(field *model.PropertyField) *model.PropertyField {
		t.Helper()
		created, appErr := th.App.CreatePropertyField(admin, field, false, "")
		require.Nil(t, appErr)
		return created
	}

	optA, optB := model.NewId(), model.NewId()
	template := createField(&model.PropertyField{
		GroupID:    th.groupID,
		Name:       "f_" + model.NewId(),
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []any{
			map[string]any{"id": optA, "name": "A"},
			map[string]any{"id": optB, "name": "B"},
		}},
	})

	userField := createField(&model.PropertyField{
		GroupID:       th.groupID,
		Name:          "f_" + model.NewId(),
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
		// A masking field's holdings cannot be writable by the people it filters.
		Permissions: &model.Permissions{Restrictions: &model.Restrictions{
			Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelSysadmin},
			Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
		}},
	})

	postField := createField(&model.PropertyField{
		GroupID:       th.groupID,
		Name:          "f_" + model.NewId(),
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    model.PropertyFieldObjectTypePost,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
		Permissions: &model.Permissions{Restrictions: &model.Restrictions{
			Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
			Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
		}},
	})

	// The template masks by the user field: a viewer sees a value only when they hold it there. Only
	// the masking block changes: the restrictions bound the linked fields' tiers, so they stay.
	require.NotNil(t, template.Permissions)
	template.Permissions.Masking = &model.Masking{MaskByFieldID: userField.ID}
	_, _, appErr := th.App.UpdatePropertyField(admin, th.groupID, template, false, "")
	require.Nil(t, appErr)

	_, appErr = th.App.UpsertPropertyValues(admin, []*model.PropertyValue{{
		TargetID:   holder.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    th.groupID,
		FieldID:    userField.ID,
		Value:      json.RawMessage(`"` + optA + `"`),
	}}, model.PropertyValueTargetTypeUser, holder.Id, "")
	require.Nil(t, appErr)

	return maskedPostFixture{postField: postField, optionA: optA, optionB: optB}
}

// Masking applies per viewer to a post's value, exactly as it does to a user's: a post field linked to a
// masked template shows its value to a viewer who holds that value and omits it for one who doesn't.
func TestHydratePropertyValuesMasking(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPropertyValuesTest(t)
	fixture := th.newMaskedPostFixture(t, th.BasicUser)

	post := th.post(t, th.BasicChannel)
	_, err := th.App.Srv().Store().PropertyValue().Create(&model.PropertyValue{
		TargetID:   post.Id,
		TargetType: model.PropertyValueTargetTypePost,
		GroupID:    th.groupID,
		FieldID:    fixture.postField.ID,
		Value:      json.RawMessage(`"` + fixture.optionA + `"`),
		CreatedBy:  th.BasicUser.Id,
		UpdatedBy:  th.BasicUser.Id,
	})
	require.NoError(t, err)

	prepareAs := func(userID string) *model.Post {
		fresh, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, appErr)
		fresh.Metadata = nil
		viewer := th.Context.WithSession(&model.Session{UserId: userID, Roles: model.SystemUserRoleId})
		return th.App.PreparePostForClient(viewer, fresh, &model.PreparePostForClientOpts{PropertyGroupID: th.groupID})
	}

	t.Run("a viewer holding the value sees it", func(t *testing.T) {
		hydrated := prepareAs(th.BasicUser.Id)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, fixture.postField.ID, hydrated.Metadata.PropertyValues[0].FieldID)
		assert.JSONEq(t, `"`+fixture.optionA+`"`, string(hydrated.Metadata.PropertyValues[0].Value))
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
	})

	t.Run("a viewer not holding the value gets it omitted, and the post is not marked unavailable", func(t *testing.T) {
		hydrated := prepareAs(th.BasicUser2.Id)
		assert.Empty(t, hydrated.Metadata.PropertyValues)
		// Withheld is not failed: the lookup worked, so the client must not retry or show an error.
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
	})
}

// The property_values_updated event reaches every member of the channel from one payload, so a value that
// the template masks is withheld from it even though the author, who holds the value, may read it.
func TestPostPropertyValueBroadcastWithholdsMaskedValue(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPropertyValuesTest(t)
	fixture := th.newMaskedPostFixture(t, th.BasicUser)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
	post := th.post(t, th.BasicChannel)

	messages, closeWS := connectFakeWebSocket(t, th.TestHelper, th.BasicUser2.Id, "", []model.WebsocketEventType{model.WebsocketEventPropertyValuesUpdated})
	defer closeWS()

	th.setValue(t, post, fixture.postField, `"`+fixture.optionA+`"`)

	select {
	case event := <-messages:
		raw, ok := event.GetData()["values"].(string)
		require.True(t, ok, "event carries no values payload")
		var broadcast []model.PropertyValue
		require.NoError(t, json.Unmarshal([]byte(raw), &broadcast))
		require.Len(t, broadcast, 1)
		assert.Equal(t, fixture.postField.ID, broadcast[0].FieldID)
		assert.JSONEq(t, model.PropertyValueWithheldJSON, string(broadcast[0].Value))
	case <-time.After(5 * time.Second):
		require.Fail(t, "the property_values_updated event was not published")
	}
}

// createFields registers n system-scoped post-object fields in groupID. access_control caps post
// fields well below the hydration bound, so tests that need more fields use a group of their own.
func (th *propertyValuesTestHelper) createFields(t *testing.T, groupID string, n int) []*model.PropertyField {
	t.Helper()
	fields := make([]*model.PropertyField, n)
	for i := range fields {
		field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    groupID,
			Name:       "attr-" + strconv.Itoa(i),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}, false, "")
		require.Nil(t, appErr)
		fields[i] = field
	}
	return fields
}

func (th *propertyValuesTestHelper) setValues(t *testing.T, post *model.Post, groupID string, fields []*model.PropertyField) {
	t.Helper()
	values := make([]*model.PropertyValue, len(fields))
	for i, field := range fields {
		values[i] = &model.PropertyValue{
			TargetID:   post.Id,
			TargetType: model.PropertyValueTargetTypePost,
			GroupID:    groupID,
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
// merely defensive: the field bound is the post field cap, but it is applied to whatever PSAv2
// group the caller names, and nothing caps the value count at all.
//
// What matters at each guard is that the caller still gets its posts, marked "attributes unknown"
// rather than silently carrying none.
func TestHydratePropertyValuesBoundGuards(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("more applicable fields than the bound", func(t *testing.T) {
		th := setupPropertyValuesTest(t)
		post := th.post(t, th.BasicChannel)
		groupID := th.createOtherGroup(t)
		th.createFields(t, groupID, model.PostAttributesMaxFields+1)

		hydrated := th.prepare(t, post, groupID)

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
		groupID := th.createOtherGroup(t)
		fields := th.createFields(t, groupID, model.PostAttributesMaxFields)
		th.setValues(t, post, groupID, fields[:1])

		hydrated := th.prepare(t, post, groupID)

		require.NotNil(t, hydrated.Metadata)
		require.NotNil(t, hydrated.Metadata.PropertyValuesUnavailable)
		assert.False(t, *hydrated.Metadata.PropertyValuesUnavailable)
		require.Len(t, hydrated.Metadata.PropertyValues, 1)
		assert.Equal(t, fields[0].ID, hydrated.Metadata.PropertyValues[0].FieldID)
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

	// The field is never read from the store — only its Permissions, or its
	// PermissionValues when it has none — so an in-memory field carrying the
	// level under test is the whole input.
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

	// A field the way access_control stores one: value.write in Permissions,
	// optionally with grants, and no PermissionValues of its own.
	fieldWithPermissions := func(write model.PermissionLevel, grants ...model.Grant) *model.PropertyField {
		field := fieldAt(write)
		field.PermissionValues = nil
		field.Permissions = &model.Permissions{
			Restrictions: &model.Restrictions{Value: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: write}},
			Grants:       grants,
		}
		return field
	}
	grantTo := func(ownerType, id string, actions ...string) model.Grant {
		return model.Grant{Identity: model.Identity{Type: ownerType, ID: id}, Allow: actions}
	}

	// A PermissionValues left behind from before the field had Permissions,
	// which the Permissions tier must win over.
	staleColumn := fieldWithPermissions(model.PermissionLevelSysadmin)
	staleColumn.PermissionValues = model.NewPointer(model.PermissionLevelMember)

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

		// everyone lets any caller set the value, as the property API does when the same value
		// is written after the post exists.
		{"everyone level, plain member", plainMember.Id, fieldAt(model.PermissionLevelEveryone), th.BasicChannel, true},
		{"everyone level, outsider", outsider.Id, fieldAt(model.PermissionLevelEveryone), th.BasicChannel, true},

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

		// A field with Permissions takes its tier from there, whatever PermissionValues says.
		{"permissions creator, plain member", plainMember.Id, fieldWithPermissions(model.PermissionLevelCreator), th.BasicChannel, true},
		{"permissions everyone, outsider", outsider.Id, fieldWithPermissions(model.PermissionLevelEveryone), th.BasicChannel, true},
		{"permissions sysadmin, plain member", plainMember.Id, fieldWithPermissions(model.PermissionLevelSysadmin), th.BasicChannel, false},
		{"permissions none, sysadmin", th.SystemAdminUser.Id, fieldWithPermissions(model.PermissionLevelNone), th.BasicChannel, false},
		{"permissions win over a stale column, plain member", plainMember.Id, staleColumn, th.BasicChannel, false},
		{"permissions win over a stale column, sysadmin", th.SystemAdminUser.Id, staleColumn, th.BasicChannel, true},

		// A value.write grant admits the write whatever the tier says, as it does for a value
		// written after the post exists.
		{"user grant, grantee", plainMember.Id,
			fieldWithPermissions(model.PermissionLevelNone, grantTo(model.PropertyOwnerTypeUser, plainMember.Id, model.PropertyActionValueWrite)),
			th.BasicChannel, true},
		{"user grant, someone else", outsider.Id,
			fieldWithPermissions(model.PermissionLevelNone, grantTo(model.PropertyOwnerTypeUser, plainMember.Id, model.PropertyActionValueWrite)),
			th.BasicChannel, false},
		{"user grant for another action, grantee", plainMember.Id,
			fieldWithPermissions(model.PermissionLevelNone, grantTo(model.PropertyOwnerTypeUser, plainMember.Id, model.PropertyActionValueRead)),
			th.BasicChannel, false},
		{"role grant, holder of the role", plainMember.Id,
			fieldWithPermissions(model.PermissionLevelNone, grantTo(model.PropertyOwnerTypeRole, model.SystemUserRoleId, model.PropertyActionValueWrite)),
			th.BasicChannel, true},
		{"role grant, user without the role", plainMember.Id,
			fieldWithPermissions(model.PermissionLevelNone, grantTo(model.PropertyOwnerTypeRole, model.SystemAdminRoleId, model.PropertyActionValueWrite)),
			th.BasicChannel, false},
		{"user grant on a sysadmin tier, grantee", plainMember.Id,
			fieldWithPermissions(model.PermissionLevelSysadmin, grantTo(model.PropertyOwnerTypeUser, plainMember.Id, model.PropertyActionValueWrite)),
			th.BasicChannel, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want,
				th.App.CanSetPostPropertyValueOnCreate(th.Context, tc.userID, tc.field, tc.channel))
		})
	}
}

// staged builds a value in the shape a caller hands CreatePost: group, field and value only.
// CreatePost owns the target and the author, so leaving them unset here is what proves it.
func (th *propertyValuesTestHelper) staged(field *model.PropertyField, raw string) *model.PropertyValue {
	return &model.PropertyValue{
		GroupID: th.groupID,
		FieldID: field.ID,
		Value:   json.RawMessage(raw),
	}
}

// asUser points the request session at userID for the rest of the subtest. CreatePost runs
// PreparePostForClient and SanitizePostMetadataForUser against the session, so an empty one
// would not exercise the author's own view of the post it just created.
func (th *propertyValuesTestHelper) asUser(t *testing.T, userID string) {
	t.Helper()
	original := th.Context.Session().UserId
	th.Context.Session().UserId = userID
	t.Cleanup(func() { th.Context.Session().UserId = original })
}

func (th *propertyValuesTestHelper) storedValueFieldIDs(t *testing.T, postID string) []string {
	t.Helper()
	values, appErr := th.App.SearchPropertyValues(th.Context, th.groupID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypePost,
		TargetIDs:  []string{postID},
		PerPage:    model.PostAttributesMaxFields + 1,
	})
	require.Nil(t, appErr)

	ids := make([]string, 0, len(values))
	for _, value := range values {
		ids = append(ids, value.FieldID)
	}
	return ids
}

func (th *propertyValuesTestHelper) assertPendingPostIDReleased(t *testing.T, pendingPostID string) {
	t.Helper()
	var postID string
	err := th.App.Srv().seenPendingPostIdsCache.Get(pendingPostID, &postID)
	assert.ErrorIs(t, err, cache.ErrKeyNotFound,
		"the pending post id must be released so the client can retry, got %q", postID)
}

// recordingPostStore wraps a real PostStore to watch the save and the compensating delete, and
// optionally break the delete. CreatePost returns a nil post on the failure path, so these two
// calls are the only place the doomed post's ID becomes observable to a test. Save also records
// the caller ID on the context it was given, which is the context CreatePost ran with.
type recordingPostStore struct {
	store.PostStore
	deleteErr error

	mu            sync.Mutex
	savedIDs      []string
	saveCallerIDs []string
	deletedIDs    []string
}

func (r *recordingPostStore) Save(rctx request.CTX, post *model.Post) (*model.Post, error) {
	saved, err := r.PostStore.Save(rctx, post)

	r.mu.Lock()
	defer r.mu.Unlock()
	callerID, _ := CallerIDFromRequestContext(rctx)
	r.saveCallerIDs = append(r.saveCallerIDs, callerID)
	if err == nil {
		r.savedIDs = append(r.savedIDs, saved.Id)
	}
	return saved, err
}

func (r *recordingPostStore) PermanentDelete(rctx request.CTX, postID string) error {
	r.mu.Lock()
	r.deletedIDs = append(r.deletedIDs, postID)
	r.mu.Unlock()
	if r.deleteErr != nil {
		return r.deleteErr
	}
	return r.PostStore.PermanentDelete(rctx, postID)
}

type recordingPostStoreWrapper struct {
	store.Store
	posts *recordingPostStore
}

func (w *recordingPostStoreWrapper) Post() store.PostStore { return w.posts }

// watchPostStore swaps in a store whose PostStore records every Save and PermanentDelete,
// failing the delete when deleteErr is non-nil. Every other store call passes through to the
// real store, so the rest of CreatePost behaves normally.
func (th *propertyValuesTestHelper) watchPostStore(t *testing.T, deleteErr error) *recordingPostStore {
	t.Helper()
	original := th.App.Srv().Store()
	posts := &recordingPostStore{PostStore: original.Post(), deleteErr: deleteErr}
	th.App.Srv().SetStore(&recordingPostStoreWrapper{Store: original, posts: posts})
	t.Cleanup(func() { th.App.Srv().SetStore(original) })
	return posts
}

// missingFieldValueErrorID is what UpsertPropertyValues returns for missingFieldValue: its
// bulk GetPropertyFields lookup fails first, before the per-value field_not_found check.
const missingFieldValueErrorID = "app.property_field.not_found.app_error"

// missingFieldValue carries a well-formed field ID that no field has — the state a post whose
// field was deleted between validation and the write arrives in. It fails the value write
// during validation, so no property row is ever written.
func (th *propertyValuesTestHelper) missingFieldValue() *model.PropertyValue {
	return &model.PropertyValue{
		GroupID: th.groupID,
		FieldID: model.NewId(),
		Value:   json.RawMessage(`"confidential"`),
	}
}

func TestCreatePostPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("staged values are written, attached and persisted", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		field := th.createField(t, "sensitivity")

		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "with attributes",
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{th.staged(field, `"confidential"`)},
			},
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		require.NotNil(t, created.Metadata)
		require.Len(t, created.Metadata.PropertyValues, 1)
		written := created.Metadata.PropertyValues[0]
		assert.Equal(t, field.ID, written.FieldID)
		assert.JSONEq(t, `"confidential"`, string(written.Value))
		// The caller stages group, field and value; these four are CreatePost's to fill in.
		assert.Equal(t, created.Id, written.TargetID)
		assert.Equal(t, model.PropertyValueTargetTypePost, written.TargetType)
		assert.Equal(t, th.BasicUser.Id, written.CreatedBy)
		assert.Equal(t, th.BasicUser.Id, written.UpdatedBy)

		// Attaching to the returned post is not enough on its own: the rows have to be in the
		// store, so a later read of the same post finds them.
		assert.Equal(t, []string{field.ID}, th.storedValueFieldIDs(t, created.Id))
		hydrated := th.prepare(t, created, th.groupID)
		assert.Equal(t, []string{field.ID}, valueFieldIDs(hydrated))
	})

	t.Run("a reply behaves like a root post", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		field := th.createField(t, "sensitivity")
		root := th.post(t, th.BasicChannel)

		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			RootId:    root.Id,
			Message:   "reply with attributes",
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{th.staged(field, `"secret"`)},
			},
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		require.Len(t, created.Metadata.PropertyValues, 1)
		// The values belong to the reply, not to the thread's root.
		assert.Equal(t, created.Id, created.Metadata.PropertyValues[0].TargetID)
		assert.Equal(t, []string{field.ID}, th.storedValueFieldIDs(t, created.Id))
		assert.Empty(t, th.storedValueFieldIDs(t, root.Id))
	})

	// Callers such as the /test json command reach CreatePost without the prepare step, so a
	// nil value has to be refused before the save rather than dereferenced after it.
	t.Run("a nil value is refused before the post is saved", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		field := th.createField(t, "sensitivity")

		before, appErr := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 100)
		require.Nil(t, appErr)

		var created *model.Post
		require.NotPanics(t, func() {
			created, _, appErr = th.App.CreatePost(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    th.BasicUser.Id,
				Message:   "nil attribute",
				Metadata: &model.PostMetadata{
					PropertyValues: []*model.PropertyValue{th.staged(field, `"x"`), nil},
				},
			}, th.BasicChannel, model.CreatePostFlags{})
		})
		require.NotNil(t, appErr)
		assert.Equal(t, "api.post.create_post.invalid_attribute.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Nil(t, created)

		after, appErr := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 100)
		require.Nil(t, appErr)
		assert.Len(t, after.Order, len(before.Order), "no post may be saved")
	})

	// Every existing caller leaves Metadata nil or without PropertyValues, and must
	// keep behaving exactly as it did.
	t.Run("no staged values writes nothing", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		th.createField(t, "sensitivity")

		testCases := []struct {
			name     string
			metadata *model.PostMetadata
		}{
			{"nil metadata", nil},
			{"metadata without values", &model.PostMetadata{}},
			{"an empty value slice", &model.PostMetadata{PropertyValues: []*model.PropertyValue{}}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					ChannelId: th.BasicChannel.Id,
					UserId:    th.BasicUser.Id,
					Message:   "no attributes",
					Metadata:  tc.metadata,
				}, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, appErr)

				require.NotNil(t, created.Metadata)
				assert.Empty(t, created.Metadata.PropertyValues)
				// No rows written is the observable half of "UpsertPropertyValues was never
				// called": the call has no other effect that survives the request.
				assert.Empty(t, th.storedValueFieldIDs(t, created.Id))
			})
		}
	})

	t.Run("a failed value write removes the post and releases the pending id", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		deletes := th.watchPostStore(t, nil)

		pendingPostID := model.NewId()
		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId:     th.BasicChannel.Id,
			UserId:        th.BasicUser.Id,
			Message:       "doomed",
			PendingPostId: pendingPostID,
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{th.missingFieldValue()},
			},
		}, th.BasicChannel, model.CreatePostFlags{})

		require.NotNil(t, appErr)
		assert.Equal(t, missingFieldValueErrorID, appErr.Id)
		assert.Nil(t, created)

		require.Len(t, deletes.deletedIDs, 1, "the post that was just saved must be deleted again")
		_, getErr := th.App.GetSinglePost(th.Context, deletes.deletedIDs[0], true)
		require.NotNil(t, getErr)
		assert.Equal(t, http.StatusNotFound, getErr.StatusCode)

		// Without this the client's retry is deduplicated against a post that no longer
		// exists, and the author silently loses the message.
		th.assertPendingPostIDReleased(t, pendingPostID)
	})

	t.Run("a failed value write whose compensating delete also fails", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		deletes := th.watchPostStore(t, assert.AnError)

		pendingPostID := model.NewId()
		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId:     th.BasicChannel.Id,
			UserId:        th.BasicUser.Id,
			Message:       "doomed and undeletable",
			PendingPostId: pendingPostID,
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{th.missingFieldValue()},
			},
		}, th.BasicChannel, model.CreatePostFlags{})

		// The caller is told why the write failed; the delete failure is only logged, so it
		// cannot mask the reason the post was rejected.
		require.NotNil(t, appErr)
		assert.Equal(t, missingFieldValueErrorID, appErr.Id)
		assert.Nil(t, created)
		th.assertPendingPostIDReleased(t, pendingPostID)

		require.Len(t, deletes.deletedIDs, 1)
		// The post outlives the failed write — the state the log line exists to report. Not
		// asserted as "gone", because the delete that would have removed it also failed.
		surviving, getErr := th.App.GetSinglePost(th.Context, deletes.deletedIDs[0], true)
		require.Nil(t, getErr)
		assert.Equal(t, "doomed and undeletable", surviving.Message)
		assert.Empty(t, th.storedValueFieldIDs(t, surviving.Id))

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlError.Name,
			"Failed to remove post after its attribute values could not be written")
	})

	// The `posted` event reaches every channel member as one payload, with nothing filtering a
	// value per reader, so it carries no values. Members get them from property_values_updated,
	// which withholds a value not every member may read; the author gets them back from
	// CreatePost.
	t.Run("values reach members through property_values_updated, not the posted event", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)
		openField := th.createField(t, "sensitivity")
		restrictedField, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.groupID,
			Name:       "f_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Value:  model.ReadWrite{Read: model.PermissionLevelSysadmin, Write: model.PermissionLevelMember},
				Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
				Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		}, false, "")
		require.Nil(t, appErr)

		// Joining generates its own `posted` event, so it has to happen before the socket is
		// connected or that event would be one of those read below.
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

		messages, closeWS := connectFakeWebSocket(t, th.TestHelper, th.BasicUser2.Id, "",
			[]model.WebsocketEventType{model.WebsocketEventPosted, model.WebsocketEventPropertyValuesUpdated})
		defer closeWS()

		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "broadcast with attributes",
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{
					th.staged(openField, `"confidential"`),
					th.staged(restrictedField, `"secret"`),
				},
			},
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// The author wrote both values and gets both back, unfiltered.
		require.NotNil(t, created.Metadata)
		require.Len(t, created.Metadata.PropertyValues, 2)

		received := map[model.WebsocketEventType]*model.WebSocketEvent{}
		for len(received) < 2 {
			select {
			case event := <-messages:
				received[event.EventType()] = event
			case <-time.After(10 * time.Second):
				require.FailNow(t, "timed out waiting for the posted and property_values_updated events")
			}
		}

		postJSON, ok := received[model.WebsocketEventPosted].GetData()["post"].(string)
		require.True(t, ok, "the posted event must carry the post")
		var broadcast model.Post
		require.NoError(t, json.Unmarshal([]byte(postJSON), &broadcast))
		require.Equal(t, created.Id, broadcast.Id)
		if broadcast.Metadata != nil {
			assert.Empty(t, broadcast.Metadata.PropertyValues)
		}

		valuesEvent := received[model.WebsocketEventPropertyValuesUpdated]
		assert.Equal(t, created.Id, valuesEvent.GetData()["target_id"])
		valuesJSON, ok := valuesEvent.GetData()["values"].(string)
		require.True(t, ok, "the values event must carry the values")
		var values []*model.PropertyValue
		require.NoError(t, json.Unmarshal([]byte(valuesJSON), &values))
		byField := map[string]string{}
		for _, v := range values {
			byField[v.FieldID] = string(v.Value)
		}
		require.Len(t, byField, 2)
		assert.JSONEq(t, `"confidential"`, byField[openField.ID])
		assert.JSONEq(t, model.PropertyValueWithheldJSON, byField[restrictedField.ID])
	})

	// property_values_updated and the property value API would hand the values to channel
	// members who haven't revealed the post, so the post is refused before it is saved.
	t.Run("a burn-on-read post with values is refused before it is saved", func(t *testing.T) {
		th := setupPropertyValuesCreateTest(t, true)
		th.asUser(t, th.BasicUser.Id)

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableBurnOnRead = new(true)
		})

		field := th.createField(t, "sensitivity")
		posts := th.watchPostStore(t, nil)

		pendingPostID := model.NewId()
		borPost := &model.Post{
			ChannelId:     th.BasicChannel.Id,
			UserId:        th.BasicUser.Id,
			Message:       "burn after reading",
			Type:          model.PostTypeBurnOnRead,
			PendingPostId: pendingPostID,
			Metadata: &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{th.staged(field, `"confidential"`)},
			},
		}
		borPost.AddProp(model.PostPropsExpireAt, model.GetMillis()+int64(10*60*1000))

		created, _, appErr := th.App.CreatePost(th.Context, borPost, th.BasicChannel, model.CreatePostFlags{})
		require.NotNil(t, appErr)
		assert.Equal(t, "api.post.create_post.attributes_burn_on_read.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Nil(t, created)
		assert.Empty(t, posts.savedIDs)
		assert.Empty(t, posts.deletedIDs)
		th.assertPendingPostIDReleased(t, pendingPostID)

		t.Run("without values it is created as before", func(t *testing.T) {
			borPost := &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    th.BasicUser.Id,
				Message:   "burn after reading",
				Type:      model.PostTypeBurnOnRead,
			}
			borPost.AddProp(model.PostPropsExpireAt, model.GetMillis()+int64(10*60*1000))
			_, _, appErr := th.App.CreatePost(th.Context, borPost, th.BasicChannel, model.CreatePostFlags{})
			require.Nil(t, appErr)
		})
	})
}

func TestCreatePostPropertyValuesFeatureFlagOff(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPropertyValuesCreateTest(t, false)
	th.asUser(t, th.BasicUser.Id)
	// The field exists and the value is staged as a caller would after validating it, so the
	// refusal is the flag's doing and not a failed lookup or write.
	field := th.createField(t, "sensitivity")
	posts := th.watchPostStore(t, nil)

	pendingPostID := model.NewId()
	created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId:     th.BasicChannel.Id,
		UserId:        th.BasicUser.Id,
		Message:       "flag off",
		PendingPostId: pendingPostID,
		Metadata: &model.PostMetadata{
			PropertyValues: []*model.PropertyValue{th.staged(field, `"confidential"`)},
		},
	}, th.BasicChannel, model.CreatePostFlags{})

	require.NotNil(t, appErr)
	assert.Equal(t, "api.post.create_post.attributes_feature_disabled.app_error", appErr.Id)
	assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	assert.Nil(t, created)

	// Refused before the save, so there is no post row and nothing to roll back.
	assert.Empty(t, posts.savedIDs)
	assert.Empty(t, posts.deletedIDs)
	th.assertPendingPostIDReleased(t, pendingPostID)
}

// An edit never writes values, yet UpdatePost sends the edited post unfiltered to every channel
// member in `post_edited`. Values in the edit request are dropped rather than refused, so a client
// that sends a fetched post's metadata back unchanged can still edit it.
func TestUpdatePostDropsPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)

	for _, flagEnabled := range []bool{true, false} {
		t.Run("PostAttributes "+strconv.FormatBool(flagEnabled), func(t *testing.T) {
			th := setupPropertyValuesCreateTest(t, flagEnabled)
			th.asUser(t, th.BasicUser.Id)
			field := th.createField(t, "sensitivity")
			post := th.post(t, th.BasicChannel)
			th.setValue(t, post, field, `"public"`)

			th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
			messages, closeWS := connectFakeWebSocket(t, th.TestHelper, th.BasicUser2.Id, "",
				[]model.WebsocketEventType{model.WebsocketEventPostEdited})
			defer closeWS()

			edit := post.Clone()
			edit.Message = "edited"
			edit.Metadata = &model.PostMetadata{
				PropertyValues: []*model.PropertyValue{
					th.staged(field, `"confidential"`),
					{FieldID: model.NewId(), Value: json.RawMessage(`"confidential"`)},
				},
				PropertyValuesUnavailable: model.NewPointer(true),
			}
			updated, _, appErr := th.App.UpdatePost(th.Context, edit, nil)
			require.Nil(t, appErr)
			assert.Equal(t, "edited", updated.Message)
			assert.Empty(t, updated.Metadata.PropertyValues)
			assert.Nil(t, updated.Metadata.PropertyValuesUnavailable)

			var event *model.WebSocketEvent
			select {
			case event = <-messages:
			case <-time.After(10 * time.Second):
				require.FailNow(t, "timed out waiting for the post_edited event")
			}
			postJSON, ok := event.GetData()["post"].(string)
			require.True(t, ok, "the post_edited event must carry the post")
			var broadcast model.Post
			require.NoError(t, json.Unmarshal([]byte(postJSON), &broadcast))
			require.Equal(t, post.Id, broadcast.Id)
			assert.Equal(t, "edited", broadcast.Message)
			if broadcast.Metadata != nil {
				assert.Empty(t, broadcast.Metadata.PropertyValues)
				assert.Nil(t, broadcast.Metadata.PropertyValuesUnavailable)
			}

			stored, appErr := th.App.SearchPropertyValues(th.Context, th.groupID, model.PropertyValueSearchOpts{
				TargetType: model.PropertyValueTargetTypePost,
				TargetIDs:  []string{post.Id},
				PerPage:    model.PostAttributesMaxFields + 1,
			})
			require.Nil(t, appErr)
			require.Len(t, stored, 1)
			assert.Equal(t, field.ID, stored[0].FieldID)
			assert.JSONEq(t, `"public"`, string(stored[0].Value))
		})
	}
}

const (
	replaceWithoutValuesMessage = "replacement without values"
	replaceWithValuesMessage    = "replacement with values"
	replaceAsBurnOnReadMessage  = "replacement as burn-on-read"
)

// replacementPostPlugin builds a MessageWillBePosted plugin that hands back a replacement post
// carrying its own metadata, picked by the post's message: replaceWithoutValuesMessage gets
// metadata with a priority and no values, replaceWithValuesMessage gets metadata with a value
// for fieldID, and replaceAsBurnOnReadMessage turns the post into a burn-on-read one with an
// expiry, keeping its metadata and dropping its pending post id. Any other message is let
// through unchanged.
func replacementPostPlugin(groupID, fieldID string) string {
	return `
		package main

		import (
			"encoding/json"

			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			switch post.Message {
			case "` + replaceWithoutValuesMessage + `":
				post.Metadata = &model.PostMetadata{
					Priority: &model.PostPriority{Priority: model.NewPointer(model.PostPriorityUrgent)},
				}
				return post, ""
			case "` + replaceWithValuesMessage + `":
				post.Metadata = &model.PostMetadata{
					PropertyValues: []*model.PropertyValue{{
						GroupID: "` + groupID + `",
						FieldID: "` + fieldID + `",
						Value:   json.RawMessage("\"injected\""),
					}},
				}
				return post, ""
			case "` + replaceAsBurnOnReadMessage + `":
				post.Type = model.PostTypeBurnOnRead
				post.AddProp(model.PostPropsExpireAt, model.GetMillis()+10*60*1000)
				post.PendingPostId = ""
				return post, ""
			}
			return nil, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`
}

// A plugin's replacement post keeps the values CreatePost was given: they were validated
// before the hooks ran, and a plugin sets values through the plugin API instead. Both places
// that take a replacement are covered: the MessageWillBePosted fan-out and the channel guard.
func TestCreatePostPropertyValuesReplacementPost(t *testing.T) {
	mainHelper.Parallel(t)

	testCases := []struct {
		name  string
		guard bool
	}{
		{"from a MessageWillBePosted plugin", false},
		{"from a channel guard plugin", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			th := setupPropertyValuesCreateTest(t, true)
			th.asUser(t, th.BasicUser.Id)
			field := th.createField(t, "sensitivity")

			tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{replacementPostPlugin(th.groupID, field.ID)}, th.App, th.NewPluginAPI)
			t.Cleanup(tearDown)
			require.Len(t, errs, 1)
			require.NoError(t, errs[0])
			require.Len(t, pluginIDs, 1)

			if tc.guard {
				require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginIDs[0]))
				require.Len(t, th.App.Channels().getGuardsForChannel(th.BasicChannel.Id), 1)
			}

			t.Run("a replacement with its own metadata keeps the original values", func(t *testing.T) {
				created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					ChannelId: th.BasicChannel.Id,
					UserId:    th.BasicUser.Id,
					Message:   replaceWithoutValuesMessage,
					Metadata: &model.PostMetadata{
						PropertyValues: []*model.PropertyValue{th.staged(field, `"confidential"`)},
					},
				}, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, appErr)

				require.Len(t, created.Metadata.PropertyValues, 1)
				assert.Equal(t, field.ID, created.Metadata.PropertyValues[0].FieldID)
				assert.JSONEq(t, `"confidential"`, string(created.Metadata.PropertyValues[0].Value))
				assert.Equal(t, []string{field.ID}, th.storedValueFieldIDs(t, created.Id))
			})

			// The original carries a priority, so it has metadata of its own and the replacement's
			// metadata is the one kept, with only the priority and the values restored.
			t.Run("a replacement cannot add values", func(t *testing.T) {
				created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					ChannelId: th.BasicChannel.Id,
					UserId:    th.BasicUser.Id,
					Message:   replaceWithValuesMessage,
					Metadata: &model.PostMetadata{
						Priority: &model.PostPriority{Priority: model.NewPointer(model.PostPriorityUrgent)},
					},
				}, th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, appErr)

				assert.Empty(t, created.Metadata.PropertyValues)
				assert.Empty(t, th.storedValueFieldIDs(t, created.Id))
			})

			// The burn-on-read refusal runs before the hooks, so a replacement that changes the
			// type has to be checked again before the save. The replacement also drops the
			// pending post id, which must still be released for the client's retry.
			t.Run("a replacement turned into a burn-on-read post with values is refused", func(t *testing.T) {
				posts := th.watchPostStore(t, nil)

				pendingPostID := model.NewId()
				created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
					ChannelId:     th.BasicChannel.Id,
					UserId:        th.BasicUser.Id,
					Message:       replaceAsBurnOnReadMessage,
					PendingPostId: pendingPostID,
					Metadata: &model.PostMetadata{
						PropertyValues: []*model.PropertyValue{th.staged(field, `"confidential"`)},
					},
				}, th.BasicChannel, model.CreatePostFlags{})
				require.NotNil(t, appErr)
				assert.Equal(t, "api.post.create_post.attributes_burn_on_read.app_error", appErr.Id)
				assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
				assert.Nil(t, created)
				assert.Empty(t, posts.savedIDs)
				assert.Empty(t, posts.deletedIDs)
				th.assertPendingPostIDReleased(t, pendingPostID)
			})
		})
	}
}

func TestPreparePostPropertyValuesForCreate(t *testing.T) {
	mainHelper.Parallel(t)

	th := setupPropertyValuesTest(t)
	systemField := th.createField(t, "f_"+model.NewId())
	secondField := th.createField(t, "f_"+model.NewId())
	channelField := th.createField(t, "f_"+model.NewId())

	// submitted builds the shape a caller hands in: field and value, nothing the server owns.
	submitted := func(fieldID, raw string) *model.PropertyValue {
		return &model.PropertyValue{FieldID: fieldID, Value: json.RawMessage(raw)}
	}

	requireInvalid := func(t *testing.T, items ...*model.PropertyValue) {
		t.Helper()
		values, fields, err := th.App.PreparePostPropertyValuesForCreate(th.Context, items, th.BasicChannel)
		require.Error(t, err)
		appErr := model.AsAppError(err)
		assert.Equal(t, "api.post.create_post.invalid_attribute.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Nil(t, values)
		assert.Nil(t, fields)
	}

	t.Run("values come back fresh, each with its field", func(t *testing.T) {
		values, fields, err := th.App.PreparePostPropertyValuesForCreate(th.Context, []*model.PropertyValue{
			submitted(systemField.ID, `"sys"`),
			submitted(secondField.ID, `"second"`),
			submitted(channelField.ID, `"chan"`),
		}, th.BasicChannel)
		require.NoError(t, err)

		require.Len(t, values, 3)
		require.Len(t, fields, 3)
		expected := []struct {
			field *model.PropertyField
			raw   string
		}{
			{systemField, `"sys"`},
			{secondField, `"second"`},
			{channelField, `"chan"`},
		}
		for i, want := range expected {
			assert.Equal(t, want.field.ID, fields[i].ID)
			assert.Equal(t, want.field.ID, values[i].FieldID)
			assert.JSONEq(t, want.raw, string(values[i].Value))
			// The group is the server's to fill in; everything CreatePost assigns stays unset.
			assert.Equal(t, th.groupID, values[i].GroupID)
			assert.Empty(t, values[i].ID)
			assert.Empty(t, values[i].TargetID)
			assert.Empty(t, values[i].TargetType)
			assert.Empty(t, values[i].CreatedBy)
		}
	})

	t.Run("a field from another group is unknown", func(t *testing.T) {
		otherGroupField := th.createOtherGroupField(t)
		requireInvalid(t, submitted(otherGroupField.ID, `"x"`))
	})

	t.Run("a well-formed id no field has is unknown", func(t *testing.T) {
		requireInvalid(t, submitted(model.NewId(), `"x"`))
	})

	t.Run("the same field twice is refused", func(t *testing.T) {
		requireInvalid(t, submitted(channelField.ID, `"first"`), submitted(channelField.ID, `"second"`))
	})

	t.Run("a malformed field id is refused", func(t *testing.T) {
		requireInvalid(t, submitted("not-an-id", `"x"`))
	})

	t.Run("a nil value is refused", func(t *testing.T) {
		requireInvalid(t, submitted(channelField.ID, `"x"`), nil)
	})

	t.Run("an entry without a value is refused", func(t *testing.T) {
		requireInvalid(t, &model.PropertyValue{FieldID: channelField.ID})
	})

	t.Run("an entry with a blank value is refused", func(t *testing.T) {
		requireInvalid(t, submitted(channelField.ID, "  "))
	})

	// The access_control hook would refuse these too, but only after the post is saved, so
	// they have to be caught here.
	t.Run("a text value over the length cap is refused", func(t *testing.T) {
		requireInvalid(t, submitted(channelField.ID, `"`+strings.Repeat("a", model.PropertyFieldValueTypeTextMaxLength+1)+`"`))
	})

	t.Run("a text value at the length cap goes through", func(t *testing.T) {
		values, _, err := th.App.PreparePostPropertyValuesForCreate(th.Context, []*model.PropertyValue{
			submitted(channelField.ID, `"`+strings.Repeat("a", model.PropertyFieldValueTypeTextMaxLength)+`"`),
		}, th.BasicChannel)
		require.NoError(t, err)
		require.Len(t, values, 1)
	})

	t.Run("a non-string value for a text field is refused", func(t *testing.T) {
		requireInvalid(t, submitted(channelField.ID, `42`))
	})

	t.Run("a text value that does not fit the field's value_type is refused", func(t *testing.T) {
		emailField, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.groupID,
			Name:       "f_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{model.PropertyFieldAttrValueType: model.PropertyFieldValueTypeEmail},
		}, false, "")
		require.Nil(t, appErr)

		requireInvalid(t, submitted(emailField.ID, `"not-an-email"`))

		values, _, err := th.App.PreparePostPropertyValuesForCreate(th.Context, []*model.PropertyValue{
			submitted(emailField.ID, `"someone@example.com"`),
		}, th.BasicChannel)
		require.NoError(t, err)
		require.Len(t, values, 1)
	})

	// One subtest per server-owned field rather than a loop, so a regression in handling any one
	// of them names itself in the failure output.
	t.Run("server-owned fields set by the caller are refused", func(t *testing.T) {
		refuse := func(t *testing.T, set func(v *model.PropertyValue)) {
			t.Helper()
			value := submitted(channelField.ID, `"x"`)
			set(value)
			requireInvalid(t, value)
		}

		t.Run("id", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.ID = model.NewId() }) })
		t.Run("group_id", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.GroupID = th.groupID }) })
		t.Run("target_id", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.TargetID = model.NewId() }) })
		t.Run("target_type", func(t *testing.T) {
			refuse(t, func(v *model.PropertyValue) { v.TargetType = model.PropertyValueTargetTypePost })
		})
		t.Run("create_at", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.CreateAt = model.GetMillis() }) })
		t.Run("update_at", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.UpdateAt = model.GetMillis() }) })
		t.Run("delete_at", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.DeleteAt = model.GetMillis() }) })
		t.Run("created_by", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.CreatedBy = th.BasicUser.Id }) })
		t.Run("updated_by", func(t *testing.T) { refuse(t, func(v *model.PropertyValue) { v.UpdatedBy = th.BasicUser.Id }) })
	})
}
