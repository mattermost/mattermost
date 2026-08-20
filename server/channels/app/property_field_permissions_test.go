// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPropertyRestrictionsAllow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	// BasicUser2 is in the channel but never promoted to channel admin, so it
	// is a plain member for every case below.
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	t.Run("everyone is satisfied by a plain member on a channel-targeted field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "everyone field-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionFieldWrite, "")
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelEveryone, tier)

		// Same user does not satisfy admin, showing this passed as
		// "everyone" rather than an accidental fallthrough.
		adminField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "admin field-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelAdmin},
				},
			},
		}
		_, ok = th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, adminField, model.PropertyActionFieldWrite, "")
		assert.False(t, ok)
	})

	t.Run("everyone is satisfied through the value-object dispatcher", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "everyone value-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionValueRead, th.BasicChannel.Id)
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelEveryone, tier)
	})

	t.Run("option.read on a channel-targeted field with admin restriction", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "option read admin",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Option: model.ReadWrite{Read: model.PermissionLevelAdmin},
				},
			},
		}

		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id,
			model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_, _ = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId)
		})

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, model.PropertyActionOptionRead, "")
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelAdmin, tier)

		_, ok = th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionOptionRead, "")
		assert.False(t, ok)
	})

	t.Run("value.write measured against the value's object, not the field's target", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "value write member",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelMember},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionValueWrite, th.BasicChannel.Id)
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelMember, tier)

		nonMember := th.CreateUser(t)
		_, ok = th.App.propertyRestrictionsAllow(th.Context, nonMember.Id, field, model.PropertyActionValueWrite, th.BasicChannel.Id)
		assert.False(t, ok)
	})

	t.Run("an omitted leaf denies", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "omitted leaf",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					// Option.Write left unset.
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
			},
		}

		_, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, model.PropertyActionOptionWrite, "")
		assert.False(t, ok)
	})

	t.Run("Permissions present with Restrictions nil denies every action", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:     groupID,
			Name:        "no restrictions",
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{},
		}

		for _, action := range []string{
			model.PropertyActionFieldWrite,
			model.PropertyActionOptionRead,
			model.PropertyActionOptionWrite,
			model.PropertyActionValueRead,
			model.PropertyActionValueWrite,
		} {
			_, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, action, "")
			assert.False(t, ok, "action %s should be denied", action)
		}
	})

	t.Run("empty userID denies", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "empty user",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, "", field, model.PropertyActionFieldWrite, "")
		assert.False(t, ok)
		assert.Equal(t, model.PermissionLevelNone, tier)
	})
}
