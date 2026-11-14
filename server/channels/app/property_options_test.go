// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPropertyFieldOptionsInUse(t *testing.T) {
	th := Setup(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "options_in_use", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	rctx := th.Context
	optionA, optionB, optionC := model.NewId(), model.NewId(), model.NewId()
	options := []model.PropertyFieldOption{
		{ID: optionA, Name: "A"},
		{ID: optionB, Name: "B"},
		{ID: optionC, Name: "C"},
	}

	newField := func(t *testing.T, fieldType model.PropertyFieldType, objectType, targetType string, linkedTo *model.PropertyField) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       model.NewId(),
			Type:       fieldType,
			ObjectType: objectType,
			TargetType: targetType,
		}
		if linkedTo != nil {
			field.LinkedFieldID = &linkedTo.ID
		} else {
			field.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: options}
		}
		created, err := th.Store.PropertyField().Create(field)
		require.NoError(t, err)
		return created
	}

	hold := func(t *testing.T, field *model.PropertyField, targetType, raw string) *model.PropertyValue {
		t.Helper()
		value, err := th.Store.PropertyValue().Create(&model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: targetType,
			TargetID:   model.NewId(),
			Value:      json.RawMessage(raw),
		})
		require.NoError(t, err)
		return value
	}

	system := string(model.PropertyFieldTargetLevelSystem)
	all := []string{optionA, optionB, optionC}

	t.Run("a template's options are in use through the channel fields linking to it", func(t *testing.T) {
		template := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeTemplate, system, nil)
		linked := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeChannel, system, template)
		hold(t, linked, "channel", `["`+optionA+`"]`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, template.ID, all)
		require.Nil(t, appErr)
		require.Equal(t, []string{optionA}, inUse)
	})

	t.Run("a channel field's own options are in use", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel, system, nil)
		hold(t, field, "channel", `"`+optionB+`"`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, all)
		require.Nil(t, appErr)
		require.Equal(t, []string{optionB}, inUse)
	})

	t.Run("only the options asked about are reported", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeChannel, system, nil)
		hold(t, field, "channel", `["`+optionA+`", "`+optionB+`"]`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, []string{optionB, optionC})
		require.Nil(t, appErr)
		require.Equal(t, []string{optionB}, inUse)
	})

	t.Run("a deleted value no longer holds its option", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel, system, nil)
		value := hold(t, field, "channel", `"`+optionC+`"`)
		require.NoError(t, th.Store.PropertyValue().Delete(group.ID, value.ID))

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)
	})

	t.Run("a field no channel uses reports nothing", func(t *testing.T) {
		template := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeTemplate, system, nil)
		user := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeUser, system, template)
		hold(t, user, "user", `"`+optionA+`"`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, template.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)

		inUse, appErr = th.App.PropertyFieldOptionsInUse(rctx, group.ID, user.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)
	})

	t.Run("an unknown field is not found", func(t *testing.T) {
		_, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, model.NewId(), all)
		require.NotNil(t, appErr)
	})
}
