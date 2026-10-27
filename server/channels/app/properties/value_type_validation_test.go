// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValueTypeValidationHook(t *testing.T) {
	th := Setup(t)
	th.service.AddHook(NewValueTypeValidationHook(th.service))
	th.service.AddHook(NewTypeChangeValueCleanupHook(th.service))

	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
	team := th.CreateTeam(t)
	channel := th.CreateChannel(t, team.Id)

	newField := func(t *testing.T, fieldType model.PropertyFieldType) *model.PropertyField {
		t.Helper()
		return th.CreatePropertyField(t, th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       string(fieldType) + "_" + model.NewId(),
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
		})
	}
	newValue := func(field *model.PropertyField, raw string) *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypePost,
			Value:      json.RawMessage(raw),
		}
	}

	numberField := newField(t, model.PropertyFieldTypeNumber)
	textField := newField(t, model.PropertyFieldTypeText)

	t.Run("accepts numbers and empty values on a number field", func(t *testing.T) {
		for _, raw := range []string{`3`, `-2.75`, `0`, `1e6`, `null`} {
			_, err := th.service.UpsertPropertyValue(th.Context, newValue(numberField, raw))
			assert.NoError(t, err, "value %s", raw)
		}
	})

	t.Run("refuses anything but a finite number on a number field", func(t *testing.T) {
		for _, raw := range []string{`"3"`, `""`, `true`, `[1]`, `1e400`} {
			_, err := th.service.UpsertPropertyValue(th.Context, newValue(numberField, raw))
			require.Error(t, err, "value %s", raw)
			assert.ErrorIs(t, err, ErrInvalidValue)
		}
	})

	t.Run("checks every write path and every value of a batch", func(t *testing.T) {
		_, err := th.service.CreatePropertyValue(th.Context, newValue(numberField, `"x"`))
		assert.ErrorIs(t, err, ErrInvalidValue)

		_, err = th.service.CreatePropertyValues(th.Context, []*model.PropertyValue{newValue(textField, `"ok"`), newValue(numberField, `"x"`)})
		assert.ErrorIs(t, err, ErrInvalidValue)

		_, err = th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{newValue(numberField, `1`), newValue(numberField, `"2"`)})
		assert.ErrorIs(t, err, ErrInvalidValue)

		created, err := th.service.CreatePropertyValue(th.Context, newValue(numberField, `1`))
		require.NoError(t, err)
		created.Value = json.RawMessage(`"2"`)
		_, err = th.service.UpdatePropertyValue(th.Context, group.ID, created)
		assert.ErrorIs(t, err, ErrInvalidValue)
		_, err = th.service.UpdatePropertyValues(th.Context, group.ID, []*model.PropertyValue{created})
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("checks an update against the group it writes to, not the payload's", func(t *testing.T) {
		created, err := th.service.CreatePropertyValue(th.Context, newValue(numberField, `1`))
		require.NoError(t, err)

		created.GroupID = model.NewId()
		created.Value = json.RawMessage(`"2"`)
		_, err = th.service.UpdatePropertyValue(th.Context, group.ID, created)
		assert.ErrorIs(t, err, ErrInvalidValue)
		_, err = th.service.UpdatePropertyValues(th.Context, group.ID, []*model.PropertyValue{created})
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("leaves a value whose field is not in its group to the service, and checks the rest", func(t *testing.T) {
		// Allowed before number existed (a custom profile attribute test relies on it).
		stray := newValue(numberField, `"x"`)
		stray.GroupID = model.NewId()
		_, err := th.service.CreatePropertyValue(th.Context, stray)
		assert.NoError(t, err)

		// In a batch, the fields the group does hold are still checked.
		missing := newValue(textField, `"ok"`)
		missing.FieldID = model.NewId()
		_, err = th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{missing, newValue(numberField, `"x"`)})
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("leaves the values of other types alone", func(t *testing.T) {
		_, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{newValue(textField, `12`), newValue(numberField, `5`)})
		assert.NoError(t, err)
	})

	t.Run("a type change to or from number clears the values", func(t *testing.T) {
		for _, tc := range []struct{ from, to model.PropertyFieldType }{
			{model.PropertyFieldTypeNumber, model.PropertyFieldTypeText},
			{model.PropertyFieldTypeNumber, model.PropertyFieldTypeSelect},
			{model.PropertyFieldTypeText, model.PropertyFieldTypeNumber},
		} {
			field := newField(t, tc.from)
			raw := map[model.PropertyFieldType]string{
				model.PropertyFieldTypeNumber: `4`,
				model.PropertyFieldTypeText:   `"four"`,
			}[tc.from]
			_, err := th.service.UpsertPropertyValue(th.Context, newValue(field, raw))
			require.NoError(t, err)

			field.Type = tc.to
			_, cleared, err := th.service.UpdatePropertyField(th.Context, group.ID, field)
			require.NoError(t, err, "%s -> %s", tc.from, tc.to)
			assert.Equal(t, []string{field.ID}, cleared, "%s -> %s", tc.from, tc.to)

			values, err := th.service.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{FieldID: field.ID, PerPage: 10})
			require.NoError(t, err)
			assert.Empty(t, values, "%s -> %s", tc.from, tc.to)
		}
	})
}
