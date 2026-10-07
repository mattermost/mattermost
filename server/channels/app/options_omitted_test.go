// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// oversizedOptionList returns one more option than a read will inline, so a
// field created with them always reads back with its option list withheld.
func oversizedOptionList() []any {
	options := make([]any, 0, model.PropertyFieldMaxHydratedOptions+1)
	for i := 0; i <= model.PropertyFieldMaxHydratedOptions; i++ {
		options = append(options, map[string]any{
			"id":   model.NewId(),
			"name": "Option " + model.NewId(),
		})
	}
	return options
}

// TestUpdatePropertyFields_OptionsWithheld covers a field with more options than
// a read inlines. Its option list comes back absent — the same shape as a field
// with no options — so an editor that read it holds no list, and anything it
// sends as "the options" is built on nothing.
func TestUpdatePropertyFields_OptionsWithheld(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	groupID := registerTestPropertyGroup(t, th)

	newOversizedField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    groupID,
			Name:       name,
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: oversizedOptionList(),
			},
		}, false, "")
		require.Nil(t, appErr)

		stored, appErr := th.App.GetPropertyField(th.Context, groupID, field.ID)
		require.Nil(t, appErr)
		require.True(t, model.PropertyFieldOptionsOmitted(stored.Attrs), "the field must read back with its options withheld")
		return stored
	}

	requireOptionsIntact := func(t *testing.T, fieldID string) {
		t.Helper()
		stored, appErr := th.App.GetPropertyField(th.Context, groupID, fieldID)
		require.Nil(t, appErr)
		assert.True(t, model.PropertyFieldOptionsOmitted(stored.Attrs), "the field must still have all of its options")
		assert.Equal(t, model.PropertyFieldMaxHydratedOptions+1, stored.Attrs[model.PropertyFieldAttributeOptionsCount])
	}

	// The shape the admin console produces when an admin adds an option: it
	// spreads the attrs it read and appends to `options ?? []`. Having read a
	// field whose list was withheld, the list it sends holds one option and
	// implies the other 1,001 are gone. Nothing about the request says the admin
	// meant that, so it is refused rather than obeyed or silently dropped.
	t.Run("a patch that supplies a shorter option list is refused", func(t *testing.T) {
		field := newOversizedField(t, "add-one-option")
		field.Patch(&model.PropertyFieldPatch{Attrs: &model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "Newly Added"},
			},
		}}, true)

		_, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, field, false, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.property_field.update.options_withheld.app_error", appErr.Id)
		requireOptionsIntact(t, field.ID)
	})

	t.Run("a field under the cap still accepts an option list", func(t *testing.T) {
		field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    groupID,
			Name:       "small-field",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "First"},
				},
			},
		}, false, "")
		require.Nil(t, appErr)

		stored, appErr := th.App.GetPropertyField(th.Context, groupID, field.ID)
		require.Nil(t, appErr)
		stored.Patch(&model.PropertyFieldPatch{Attrs: &model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "Replacement"},
			},
		}}, true)

		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, stored, false, "")
		require.Nil(t, appErr)
		options, ok := updated.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok)
		require.Len(t, options, 1)
		assert.Equal(t, "Replacement", options[0].(map[string]any)["name"])
	})
}
