// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSessionAttributesHook(t *testing.T) {
	th := Setup(t)
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
	th.service.AddHook(NewSessionAttributesHook(th.service, group.ID))

	createField := func() *model.PropertyField {
		f, err := th.service.CreatePropertyField(nil, &model.PropertyField{
			GroupID:    group.ID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeSession,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.SAAttrEnabled:            false,
				model.SAAttrTTLSeconds:         15,
				model.SAAttrGracePeriodSeconds: 15,
			},
		})
		require.NoError(t, err)
		return f
	}

	t.Run("blocks create from a normal caller", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeSession,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.Error(t, err)
	})

	t.Run("allows tuning enabled/ttl/grace from a normal caller", func(t *testing.T) {
		f := createField()
		current, err := th.service.GetPropertyField(th.Context, group.ID, f.ID)
		require.NoError(t, err)

		current.Attrs[model.SAAttrEnabled] = true
		current.Attrs[model.SAAttrTTLSeconds] = 60
		current.Attrs[model.SAAttrGracePeriodSeconds] = 60
		_, _, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{current})
		require.NoError(t, err)
	})

	t.Run("blocks renaming from a normal caller", func(t *testing.T) {
		f := createField()
		current, err := th.service.GetPropertyField(th.Context, group.ID, f.ID)
		require.NoError(t, err)

		current.Name = "renamed"
		_, _, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{current})
		require.Error(t, err)
	})

	t.Run("blocks introducing a non-tunable attr from a normal caller", func(t *testing.T) {
		f := createField()
		current, err := th.service.GetPropertyField(th.Context, group.ID, f.ID)
		require.NoError(t, err)

		current.Attrs[model.SAAttrDisplayName] = "Hacked"
		_, _, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{current})
		require.Error(t, err)
	})

	t.Run("blocks delete from a normal caller", func(t *testing.T) {
		f := createField()
		err := th.service.DeletePropertyField(th.Context, group.ID, f.ID)
		require.Error(t, err)
	})

	t.Run("allows delete from the system caller", func(t *testing.T) {
		f := createField()
		err := th.service.DeletePropertyField(nil, group.ID, f.ID)
		require.NoError(t, err)
	})
}
