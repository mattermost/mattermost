// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestResolveValueBroadcastParams(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("post object type returns channel ID from the post", func(t *testing.T) {
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "test post for broadcast",
		}
		created, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypePost, created.Id)
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Equal(t, th.BasicChannel.Id, channelID)
	})

	t.Run("channel object type returns the target ID as channel ID", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeChannel, "chan123")
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Equal(t, "chan123", channelID)
	})

	t.Run("user object type returns empty strings for system-wide broadcast", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeUser, "user123")
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Empty(t, channelID)
	})

	t.Run("system object type returns empty strings for system-wide broadcast", func(t *testing.T) {
		teamID, channelID, err := th.App.resolveValueBroadcastParams(th.Context, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID)
		require.Nil(t, err)
		assert.Empty(t, teamID)
		assert.Empty(t, channelID)
	})

	t.Run("unknown object type returns an error", func(t *testing.T) {
		_, _, err := th.App.resolveValueBroadcastParams(th.Context, "unknown_type", "target123")
		require.NotNil(t, err)
		assert.Equal(t, "app.property_value.resolve_broadcast_params.unknown_object_type.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})
}

func TestUpsertPropertyValues_Invariants(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	// Create a target user-typed field for the happy paths.
	field := &model.PropertyField{
		GroupID:    groupID,
		Name:       "upsert-target-" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	makeValue := func(fieldID string) *model.PropertyValue {
		return &model.PropertyValue{
			TargetID:   th.BasicUser.Id,
			TargetType: model.PropertyFieldObjectTypeUser,
			GroupID:    groupID,
			FieldID:    fieldID,
			Value:      []byte("\"v\""),
			CreatedBy:  th.BasicUser.Id,
			UpdatedBy:  th.BasicUser.Id,
		}
	}

	t.Run("rejects duplicate FieldID", func(t *testing.T) {
		v := []*model.PropertyValue{makeValue(createdField.ID), makeValue(createdField.ID)}
		result, err := th.App.UpsertPropertyValues(th.Context, v, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, "")
		require.NotNil(t, err)
		assert.Nil(t, result)
		assert.Equal(t, "app.property_value.upsert.duplicate_field_id.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("rejects invalid FieldID", func(t *testing.T) {
		v := []*model.PropertyValue{makeValue("not-an-id")}
		result, err := th.App.UpsertPropertyValues(th.Context, v, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, "")
		require.NotNil(t, err)
		assert.Nil(t, result)
		assert.Equal(t, "app.property_value.upsert.invalid_field_id.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("rejects mixed group IDs as a clean 400", func(t *testing.T) {
		altGroup, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
			Name:    "alt_mix_" + model.NewId(),
			Version: model.PropertyGroupVersionV2,
		})
		require.Nil(t, appErr)

		altField := &model.PropertyField{
			GroupID:    altGroup.ID,
			Name:       "alt-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdAlt, appErr := th.App.CreatePropertyField(th.Context, altField, false, "")
		require.Nil(t, appErr)

		v1 := makeValue(createdField.ID)
		v2 := makeValue(createdAlt.ID)
		v2.GroupID = altGroup.ID
		result, err := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{v1, v2}, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, "")
		require.NotNil(t, err)
		assert.Nil(t, result)
		assert.Equal(t, "app.property_value.upsert.mixed_groups.app_error", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("rejects ObjectType mismatch when objectType is non-empty", func(t *testing.T) {
		// Field is ObjectType=user; request specifies channel.
		v := []*model.PropertyValue{makeValue(createdField.ID)}
		result, err := th.App.UpsertPropertyValues(th.Context, v, model.PropertyFieldObjectTypeChannel, "ch1", "")
		require.NotNil(t, err)
		assert.Nil(t, result)
		assert.Equal(t, "app.property_value.upsert.object_type_mismatch.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})

	t.Run("plugin path: empty objectType skips ObjectType match", func(t *testing.T) {
		// We don't actually need the upsert to succeed (target/etc may not
		// satisfy schema), only to bypass the ObjectType-mismatch reject.
		// Confirm by passing a wrong-typed field with objectType="" — the
		// app-layer reject should not fire; any error must come from
		// downstream layers, not "object_type_mismatch".
		v := []*model.PropertyValue{makeValue(createdField.ID)}
		_, err := th.App.UpsertPropertyValues(th.Context, v, "", "", "")
		// Either succeeds, or fails for a different reason — never the
		// object_type_mismatch reject.
		if err != nil {
			assert.NotEqual(t, "app.property_value.upsert.object_type_mismatch.app_error", err.Id)
		}
	})
}

func TestInvalidateUserPropertyValuesEpochs_GatedOnABAC(t *testing.T) {
	userID := model.NewId()

	// Returns the attributes store mock so assertions can name the method rather than the
	// Store.Attributes() accessor, which the config listener also calls.
	setup := func(t *testing.T, flag bool, abac bool) (*TestHelper, *storemocks.AttributesStore) {
		thMock := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = flag
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(abac)
		})

		mockAttributes := &storemocks.AttributesStore{}
		thMock.App.Srv().Store().(*storemocks.Store).On("Attributes").Return(mockAttributes).Maybe()

		return thMock, mockAttributes
	}

	values := []*model.PropertyValue{
		{TargetType: model.PropertyFieldObjectTypeUser, TargetID: userID},
		{TargetType: model.PropertyFieldObjectTypeUser, TargetID: userID}, // duplicate, one invalidation
		{TargetType: model.PropertyFieldObjectTypePost, TargetID: model.NewId()},
	}

	t.Run("no invalidation when the feature flag is off", func(t *testing.T) {
		thMock, mockAttributes := setup(t, false, true)

		thMock.App.invalidateUserPropertyValuesEpochs(values)
		thMock.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, userID)

		mockAttributes.AssertNotCalled(t, "InvalidateUserPropertyValuesEpoch", mock.Anything)
	})

	t.Run("no invalidation when ABAC is off", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true, false)

		thMock.App.invalidateUserPropertyValuesEpochs(values)

		mockAttributes.AssertNotCalled(t, "InvalidateUserPropertyValuesEpoch", mock.Anything)
	})

	t.Run("one invalidation per distinct user target when active", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true, true)
		mockAttributes.On("InvalidateUserPropertyValuesEpoch", userID).Once()

		thMock.App.invalidateUserPropertyValuesEpochs(values)

		mockAttributes.AssertExpectations(t)
	})

	t.Run("single-target form skips non-user targets", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true, true)

		thMock.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypePost, model.NewId())

		mockAttributes.AssertNotCalled(t, "InvalidateUserPropertyValuesEpoch", mock.Anything)
	})

	// A write made while ABAC was off must not leave the view stale for a switch back on to read,
	// and the marker is free, so only the epoch half is gated.
	t.Run("the view is marked stale even when ABAC is off", func(t *testing.T) {
		thMock, _ := setup(t, true, false)
		ch := thMock.App.Srv().Channels()

		ch.attributeViewRefreshLast = time.Now()
		thMock.App.invalidateUserPropertyValuesEpochs(values)
		require.True(t, ch.attributeViewRefreshLast.IsZero(), "a user-targeted write should mark the view stale")

		ch.attributeViewRefreshLast = time.Now()
		thMock.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, userID)
		require.True(t, ch.attributeViewRefreshLast.IsZero(), "the single-target form should too")
	})

	t.Run("no user target means no invalidation of either kind", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true, true)
		ch := thMock.App.Srv().Channels()
		now := time.Now()
		ch.attributeViewRefreshLast = now

		thMock.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
			{TargetType: model.PropertyFieldObjectTypePost, TargetID: model.NewId()},
			nil,
		})

		require.Equal(t, now, ch.attributeViewRefreshLast)
		mockAttributes.AssertNotCalled(t, "InvalidateUserPropertyValuesEpoch", mock.Anything)
	})
}
