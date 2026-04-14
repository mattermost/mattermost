// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTypeChangePrevention(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup("test_type_change")
	require.NoError(t, err)

	t.Run("rejects type change on update", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Type = model.PropertyFieldTypeSelect
		_, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "type_change")
	})

	t.Run("allows update without type change", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Name = "renamed_" + model.NewId()
		updated, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, updateErr)
		assert.Equal(t, field.Name, updated.Name)
		assert.Equal(t, model.PropertyFieldTypeText, updated.Type)
	})

	t.Run("rejects type change in batch update", func(t *testing.T) {
		field1 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})
		field2 := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeDate,
			TargetType: "system",
			ObjectType: "user",
		})

		// Change type of field2 only
		field2.Type = model.PropertyFieldTypeText
		_, updateErr := th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{field1, field2})
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "type_change")
	})
}
