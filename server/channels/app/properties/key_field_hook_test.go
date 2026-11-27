// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestKeyFieldHook(t *testing.T) {
	th := Setup(t)
	th.service.AddHook(NewKeyFieldHook(th.service))
	th.service.AddHook(NewValueTypeValidationHook(th.service))

	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
	team := th.CreateTeam(t)
	channel := th.CreateChannel(t, team.Id)

	prefixes := 0
	newKeyFieldWithPrefix := func(prefix any) *model.PropertyField {
		return &model.PropertyField{
			GroupID:    group.ID,
			Name:       "key_" + model.NewId(),
			Type:       model.PropertyFieldTypeKey,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Attrs:      model.StringInterface{model.PropertyFieldAttrPrefix: prefix},
		}
	}
	newKeyField := func(t *testing.T) *model.PropertyField {
		t.Helper()
		prefixes++
		return th.CreatePropertyField(t, th.Context, newKeyFieldWithPrefix(fmt.Sprintf("K%d", prefixes)))
	}
	newTextField := func(t *testing.T) *model.PropertyField {
		t.Helper()
		return th.CreatePropertyField(t, th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "text_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
		})
	}
	newValue := func(field *model.PropertyField, targetID string, raw string) *model.PropertyValue {
		v := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   targetID,
			TargetType: model.PropertyValueTargetTypePost,
		}
		if raw != "" {
			v.Value = json.RawMessage(raw)
		}
		return v
	}
	numbers := func(values []*model.PropertyValue) []string {
		out := make([]string, len(values))
		for i, v := range values {
			out[i] = string(v.Value)
		}
		return out
	}

	t.Run("creating values assigns 1, 2, 3 in order", func(t *testing.T) {
		field := newKeyField(t)
		for i, want := range []string{"1", "2", "3"} {
			created, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), ""))
			require.NoError(t, err, "value %d", i)
			assert.JSONEq(t, want, string(created.Value))
		}
	})

	t.Run("a null value is treated as empty", func(t *testing.T) {
		field := newKeyField(t)
		created, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), "null"))
		require.NoError(t, err)
		assert.JSONEq(t, "1", string(created.Value))
	})

	t.Run("a batch gets consecutive numbers in input order", func(t *testing.T) {
		field := newKeyField(t)
		_, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)

		created, err := th.service.CreatePropertyValues(th.Context, []*model.PropertyValue{
			newValue(field, model.NewId(), ""),
			newValue(field, model.NewId(), ""),
			newValue(field, model.NewId(), ""),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"2", "3", "4"}, numbers(created))
	})

	t.Run("a batch does not change the values the caller passed in", func(t *testing.T) {
		field := newKeyField(t)
		in := []*model.PropertyValue{newValue(field, model.NewId(), ""), newValue(field, model.NewId(), "")}
		_, err := th.service.CreatePropertyValues(th.Context, in)
		require.NoError(t, err)
		assert.Empty(t, in[0].Value)
		assert.Empty(t, in[1].Value)
	})

	t.Run("two key fields count independently", func(t *testing.T) {
		a, b := newKeyField(t), newKeyField(t)

		first, err := th.service.CreatePropertyValue(th.Context, newValue(a, model.NewId(), ""))
		require.NoError(t, err)
		second, err := th.service.CreatePropertyValue(th.Context, newValue(a, model.NewId(), ""))
		require.NoError(t, err)
		other, err := th.service.CreatePropertyValue(th.Context, newValue(b, model.NewId(), ""))
		require.NoError(t, err)

		assert.JSONEq(t, "1", string(first.Value))
		assert.JSONEq(t, "2", string(second.Value))
		assert.JSONEq(t, "1", string(other.Value))
	})

	t.Run("a batch across two key fields allocates per field", func(t *testing.T) {
		a, b := newKeyField(t), newKeyField(t)
		created, err := th.service.CreatePropertyValues(th.Context, []*model.PropertyValue{
			newValue(a, model.NewId(), ""),
			newValue(b, model.NewId(), ""),
			newValue(a, model.NewId(), ""),
			newValue(b, model.NewId(), ""),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"1", "1", "2", "2"}, numbers(created))
	})

	t.Run("refuses a number supplied on create", func(t *testing.T) {
		field := newKeyField(t)
		_, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), "7"))
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)

		_, err = th.service.CreatePropertyValues(th.Context, []*model.PropertyValue{
			newValue(field, model.NewId(), ""),
			newValue(field, model.NewId(), "7"),
		})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("upserting a new target assigns a number", func(t *testing.T) {
		field := newKeyField(t)
		upserted, err := th.service.UpsertPropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)
		assert.JSONEq(t, "1", string(upserted.Value))

		batch, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{
			newValue(field, model.NewId(), ""),
			newValue(field, model.NewId(), "null"),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"2", "3"}, numbers(batch))
	})

	t.Run("upserting onto an existing row keeps its number", func(t *testing.T) {
		field := newKeyField(t)
		targetID := model.NewId()
		created, err := th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, ""))
		require.NoError(t, err)
		require.JSONEq(t, "1", string(created.Value))

		for _, raw := range []string{"", "null", "1"} {
			upserted, upsertErr := th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, raw))
			require.NoError(t, upsertErr, "value %q", raw)
			assert.JSONEq(t, "1", string(upserted.Value), "value %q", raw)
			assert.Equal(t, created.ID, upserted.ID, "value %q", raw)
		}

		// None of those upserts consumed a number.
		next, err := th.service.UpsertPropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)
		assert.JSONEq(t, "2", string(next.Value))
	})

	t.Run("a mixed upsert reuses stored numbers and allocates only for new rows", func(t *testing.T) {
		field := newKeyField(t)
		existingTarget := model.NewId()
		_, err := th.service.UpsertPropertyValue(th.Context, newValue(field, existingTarget, ""))
		require.NoError(t, err)

		upserted, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{
			newValue(field, model.NewId(), ""),
			newValue(field, existingTarget, ""),
			newValue(field, model.NewId(), ""),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"2", "1", "3"}, numbers(upserted))
	})

	t.Run("a target repeated in one upsert shares a number", func(t *testing.T) {
		field := newKeyField(t)
		targetID := model.NewId()
		upserted, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{
			newValue(field, targetID, ""),
			newValue(field, targetID, ""),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{"1", "1"}, numbers(upserted))

		next, err := th.service.UpsertPropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)
		assert.JSONEq(t, "2", string(next.Value))
	})

	t.Run("refuses an upsert carrying a different number", func(t *testing.T) {
		field := newKeyField(t)
		targetID := model.NewId()
		_, err := th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, ""))
		require.NoError(t, err)

		_, err = th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, "9"))
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)

		_, err = th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{newValue(field, targetID, "9")})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)

		// Nor may a number be supplied for a target that has no row yet.
		_, err = th.service.UpsertPropertyValue(th.Context, newValue(field, model.NewId(), "1"))
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("a deleted row's number is not reused", func(t *testing.T) {
		field := newKeyField(t)
		targetID := model.NewId()
		created, err := th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, ""))
		require.NoError(t, err)
		require.NoError(t, th.service.DeletePropertyValue(th.Context, group.ID, created.ID))

		again, err := th.service.UpsertPropertyValue(th.Context, newValue(field, targetID, ""))
		require.NoError(t, err)
		assert.JSONEq(t, "2", string(again.Value))
	})

	t.Run("an update may repeat the stored number but not change it", func(t *testing.T) {
		field := newKeyField(t)
		created, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)
		other, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)

		same := *created
		updated, err := th.service.UpdatePropertyValue(th.Context, group.ID, &same)
		require.NoError(t, err)
		assert.JSONEq(t, string(created.Value), string(updated.Value))

		for _, raw := range []string{"9", "null"} {
			changed := *created
			changed.Value = json.RawMessage(raw)
			_, err = th.service.UpdatePropertyValue(th.Context, group.ID, &changed)
			require.Error(t, err, "value %s", raw)
			assert.ErrorIs(t, err, ErrInvalidValue)

			_, err = th.service.UpdatePropertyValues(th.Context, group.ID, []*model.PropertyValue{&same, &changed})
			require.Error(t, err, "value %s", raw)
			assert.ErrorIs(t, err, ErrInvalidValue)
		}

		swapped := *created
		swapped.Value = other.Value
		_, err = th.service.UpdatePropertyValue(th.Context, group.ID, &swapped)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("an update is judged by the field of the row, not the payload", func(t *testing.T) {
		field := newKeyField(t)
		created, err := th.service.CreatePropertyValue(th.Context, newValue(field, model.NewId(), ""))
		require.NoError(t, err)

		forged := *created
		forged.FieldID = newTextField(t).ID
		forged.Value = json.RawMessage(`9`)
		_, err = th.service.UpdatePropertyValue(th.Context, group.ID, &forged)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidValue)
	})

	t.Run("leaves the values of other types alone", func(t *testing.T) {
		text := newTextField(t)
		targetID := model.NewId()

		created, err := th.service.CreatePropertyValue(th.Context, newValue(text, targetID, `"hello"`))
		require.NoError(t, err)
		assert.JSONEq(t, `"hello"`, string(created.Value))

		created.Value = json.RawMessage(`"bye"`)
		updated, err := th.service.UpdatePropertyValue(th.Context, group.ID, created)
		require.NoError(t, err)
		assert.JSONEq(t, `"bye"`, string(updated.Value))

		upserted, err := th.service.UpsertPropertyValue(th.Context, newValue(text, targetID, `"again"`))
		require.NoError(t, err)
		assert.JSONEq(t, `"again"`, string(upserted.Value))

		key := newKeyField(t)
		mixed, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{
			newValue(text, model.NewId(), `"x"`),
			newValue(key, model.NewId(), ""),
		})
		require.NoError(t, err)
		assert.Equal(t, []string{`"x"`, `1`}, numbers(mixed))
	})

	t.Run("leaves a value whose field is not in its group alone", func(t *testing.T) {
		stray := newValue(newKeyField(t), model.NewId(), "7")
		stray.GroupID = model.NewId()
		_, err := th.service.CreatePropertyValue(th.Context, stray)
		assert.NoError(t, err)
	})

	t.Run("normalizes the prefix to uppercase on create", func(t *testing.T) {
		field := th.CreatePropertyField(t, th.Context, newKeyFieldWithPrefix("  tsk1 "))
		assert.Equal(t, "TSK1", field.Attrs[model.PropertyFieldAttrPrefix])
	})

	t.Run("refuses a missing or invalid prefix", func(t *testing.T) {
		for name, prefix := range map[string]any{
			"missing":    nil,
			"empty":      "",
			"digit lead": "1AB",
			"symbol":     "A-B",
			"too long":   "ABCDEFGHIJK",
			"not string": 12,
		} {
			_, err := th.service.CreatePropertyField(th.Context, newKeyFieldWithPrefix(prefix))
			require.Error(t, err, name)
			assert.ErrorIs(t, err, ErrInvalidFieldAttrs, name)
		}

		noAttrs := newKeyFieldWithPrefix("X")
		noAttrs.Attrs = nil
		_, err := th.service.CreatePropertyField(th.Context, noAttrs)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidFieldAttrs)
	})

	t.Run("refuses a duplicate prefix in the same group, whatever its case", func(t *testing.T) {
		th.CreatePropertyField(t, th.Context, newKeyFieldWithPrefix("DUP"))
		_, err := th.service.CreatePropertyField(th.Context, newKeyFieldWithPrefix("dup"))
		require.Error(t, err)
		invalid, ok := errors.AsType[*store.ErrInvalidInput](err)
		require.True(t, ok, "got %T: %v", err, err)
		assert.Equal(t, "prefix", invalid.Field)
	})

	t.Run("refuses a prefix change onto another key field's prefix", func(t *testing.T) {
		first := th.CreatePropertyField(t, th.Context, newKeyFieldWithPrefix("TAKEN"))
		second := th.CreatePropertyField(t, th.Context, newKeyFieldWithPrefix("FREE"))

		second.Attrs[model.PropertyFieldAttrPrefix] = first.Attrs[model.PropertyFieldAttrPrefix]
		_, _, err := th.service.UpdatePropertyField(th.Context, group.ID, second)
		require.Error(t, err)
		_, ok := errors.AsType[*store.ErrInvalidInput](err)
		assert.True(t, ok, "got %T: %v", err, err)

		second.Attrs[model.PropertyFieldAttrPrefix] = "fresh"
		updated, _, err := th.service.UpdatePropertyField(th.Context, group.ID, second)
		require.NoError(t, err)
		assert.Equal(t, "FRESH", updated.Attrs[model.PropertyFieldAttrPrefix])
	})

	t.Run("a prefix on a non-key field is dropped", func(t *testing.T) {
		field := th.CreatePropertyField(t, th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "text_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Attrs:      model.StringInterface{model.PropertyFieldAttrPrefix: "ABC"},
		})
		assert.NotContains(t, field.Attrs, model.PropertyFieldAttrPrefix)
	})

	t.Run("refuses a type change to or from key", func(t *testing.T) {
		key := newKeyField(t)
		key.Type = model.PropertyFieldTypeText
		_, _, err := th.service.UpdatePropertyField(th.Context, group.ID, key)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidFieldAttrs)
		assert.Contains(t, err.Error(), "key field")

		key = newKeyField(t)
		key.Type = model.PropertyFieldTypeNumber
		_, _, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{key})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidFieldAttrs)

		text := newTextField(t)
		text.Type = model.PropertyFieldTypeKey
		text.Attrs = model.StringInterface{model.PropertyFieldAttrPrefix: "TOKEY"}
		_, _, err = th.service.UpdatePropertyField(th.Context, group.ID, text)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidFieldAttrs)
		assert.Contains(t, err.Error(), "key field")

		text = newTextField(t)
		text.Type = model.PropertyFieldTypeKey
		text.Attrs = model.StringInterface{model.PropertyFieldAttrPrefix: "TOKEY"}
		_, _, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{text})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrInvalidFieldAttrs)
	})

	t.Run("an update of a key field that keeps its type goes through", func(t *testing.T) {
		key := newKeyField(t)
		key.Name = "renamed_" + model.NewId()
		updated, _, err := th.service.UpdatePropertyField(th.Context, group.ID, key)
		require.NoError(t, err)
		assert.Equal(t, key.Name, updated.Name)
	})
}
