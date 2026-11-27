// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestChannelAttributesCacheInvalidation(t *testing.T) {
	setup := func(t *testing.T, abac bool) (*TestHelper, *storemocks.AttributesStore) {
		thMock := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(abac)
		})

		mockAttributes := &storemocks.AttributesStore{}
		thMock.App.Srv().Store().(*storemocks.Store).On("Attributes").Return(mockAttributes).Maybe()

		return thMock, mockAttributes
	}

	channelID := model.NewId()
	otherChannelID := model.NewId()
	values := []*model.PropertyValue{
		{TargetType: model.PropertyFieldObjectTypeChannel, TargetID: channelID},
		{TargetType: model.PropertyFieldObjectTypeChannel, TargetID: channelID}, // duplicate, one invalidation
		{TargetType: model.PropertyFieldObjectTypeChannel, TargetID: otherChannelID},
		{TargetType: model.PropertyFieldObjectTypePost, TargetID: model.NewId()},
	}

	t.Run("a channel value write invalidates that channel's entry", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true)
		mockAttributes.On("InvalidateChannelAttributes", channelID).Once()
		mockAttributes.On("InvalidateChannelAttributes", otherChannelID).Once()

		thMock.App.invalidateUserPropertyValuesEpochs(values)

		mockAttributes.AssertExpectations(t)
		mockAttributes.AssertNotCalled(t, "InvalidateUserAttributes", mock.Anything)
	})

	t.Run("the single-target form invalidates the channel's entry", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true)
		mockAttributes.On("InvalidateChannelAttributes", channelID).Once()

		thMock.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, channelID)

		mockAttributes.AssertExpectations(t)
	})

	t.Run("a field change clears the cache", func(t *testing.T) {
		thMock, mockAttributes := setup(t, true)
		mockAttributes.On("ClearUserPropertyValuesEpochCache").Once()
		mockAttributes.On("ClearUserAttributesCache").Once()
		mockAttributes.On("ClearChannelAttributesCache").Once()

		thMock.App.invalidateAllUserAttributeCaches()

		mockAttributes.AssertExpectations(t)
	})

	t.Run("nothing is invalidated while ABAC is off", func(t *testing.T) {
		thMock, mockAttributes := setup(t, false)

		thMock.App.invalidateUserPropertyValuesEpochs(values)
		thMock.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, channelID)
		thMock.App.invalidateAllUserAttributeCaches()

		mockAttributes.AssertNotCalled(t, "InvalidateChannelAttributes", mock.Anything)
		mockAttributes.AssertNotCalled(t, "ClearChannelAttributesCache")
	})
}

// TestChannelAttributesCacheWithRealStore drives the cache through the app's write paths and the
// local cache layer: a write is seen at once while ABAC is on, and a write made while ABAC was off
// is seen once it is turned back on, for both user and channel subjects.
func TestChannelAttributesCacheWithRealStore(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	setABAC := func(enabled bool) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = enabled
		})
	}
	setABAC(true)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	newField := func(objectType string) *model.PropertyField {
		t.Helper()
		field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "attr_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: objectType,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}, false, "")
		require.Nil(t, appErr)
		return field
	}
	channelField := newField(model.PropertyFieldObjectTypeChannel)
	userField := newField(model.PropertyFieldObjectTypeUser)

	write := func(field *model.PropertyField, targetID, value string) {
		t.Helper()
		_, appErr := th.App.UpsertPropertyValue(th.Context, &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: field.ObjectType,
			TargetID:   targetID,
			Value:      json.RawMessage(`"` + value + `"`),
		})
		require.Nil(t, appErr)
	}
	read := func(field *model.PropertyField, targetID string) any {
		t.Helper()
		subject, err := th.App.Srv().Store().Attributes().GetSubject(th.Context, targetID, group.ID, field.ObjectType)
		require.NoError(t, err)
		return subject.Attributes[field.Name]
	}

	channelID := th.BasicChannel.Id
	userID := th.BasicUser.Id

	write(channelField, channelID, "red")
	write(userField, userID, "Sales")
	require.Equal(t, "red", read(channelField, channelID))
	require.Equal(t, "Sales", read(userField, userID))

	t.Run("a channel value write is seen at once", func(t *testing.T) {
		write(channelField, channelID, "blue")
		assert.Equal(t, "blue", read(channelField, channelID))
	})

	t.Run("a write made while ABAC was off is seen after it is turned back on", func(t *testing.T) {
		require.Equal(t, "blue", read(channelField, channelID))
		require.Equal(t, "Sales", read(userField, userID))

		setABAC(false)
		// Turning ABAC off clears the caches too; these reads cache the current values again.
		require.Equal(t, "blue", read(channelField, channelID))
		require.Equal(t, "Sales", read(userField, userID))
		write(channelField, channelID, "green")
		write(userField, userID, "Engineering")
		// The writes skipped their invalidations, so the cached subjects are still the old ones.
		require.Equal(t, "blue", read(channelField, channelID))
		require.Equal(t, "Sales", read(userField, userID))

		setABAC(true)
		assert.Equal(t, "green", read(channelField, channelID))
		assert.Equal(t, "Engineering", read(userField, userID))
	})

	t.Run("a peer's decision invalidation evicts the channel's subject", func(t *testing.T) {
		cases := []struct {
			name    string
			inv     accessDecisionInvalidation
			evicted bool
		}{
			{"the channel is invalidated", accessDecisionInvalidation{Resources: []string{channelID}}, true},
			{"everything is invalidated", accessDecisionInvalidation{Global: true}, true},
			{"another channel is invalidated", accessDecisionInvalidation{Resources: []string{model.NewId()}}, false},
			{"a user is invalidated", accessDecisionInvalidation{Users: []string{userID}}, false},
		}
		for i, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				old := read(channelField, channelID)
				next := "peer-" + model.NewId()
				// The peer's write reaches the database, but not its eviction of this node's subject.
				_, err := th.GetSqlStore().PropertyValue().Upsert([]*model.PropertyValue{{
					GroupID:    group.ID,
					FieldID:    channelField.ID,
					TargetType: model.PropertyFieldObjectTypeChannel,
					TargetID:   channelID,
					Value:      json.RawMessage(`"` + next + `"`),
				}})
				require.NoError(t, err)
				require.Equal(t, old, read(channelField, channelID), "case %d: the old subject is still cached", i)

				data, err := json.Marshal(tc.inv)
				require.NoError(t, err)
				th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: data})

				if tc.evicted {
					assert.Equal(t, next, read(channelField, channelID))
				} else {
					assert.Equal(t, old, read(channelField, channelID))
				}
				// Leave the cache in step with the database for the next case.
				th.App.Srv().Store().Attributes().InvalidateChannelAttributes(channelID)
			})
		}
	})
}
