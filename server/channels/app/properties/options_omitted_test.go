// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// oversizedOptions returns one more option than a read will inline, so a field
// created with them always reads back with its option list withheld.
// withRank gives every option a distinct positive rank, which a rank field
// requires and a select field ignores.
func oversizedOptions(withRank bool) []any {
	options := make([]any, 0, model.PropertyFieldMaxHydratedOptions+1)
	for i := 0; i <= model.PropertyFieldMaxHydratedOptions; i++ {
		opt := map[string]any{
			"id":   model.NewId(),
			"name": fmt.Sprintf("Option %04d", i),
		}
		if withRank {
			opt["rank"] = i + 1
		}
		options = append(options, opt)
	}
	return options
}

func optionIDAt(t *testing.T, options []any, index int) string {
	t.Helper()
	id, ok := options[index].(map[string]any)["id"].(string)
	require.True(t, ok)
	return id
}

// requireOptionsWithheld asserts a field reads back in the shape a field above
// the hydration cap does: no option list, and the two keys standing in for it.
func requireOptionsWithheld(t *testing.T, field *model.PropertyField) {
	t.Helper()
	require.NotContains(t, field.Attrs, model.PropertyFieldAttributeOptions)
	require.True(t, model.PropertyFieldOptionsOmitted(field.Attrs))
	require.Equal(t, model.PropertyFieldMaxHydratedOptions+1, field.Attrs[model.PropertyFieldAttributeOptionsCount])
}

// requireStoredOptionsWithheld reads the field back and asserts the withheld
// shape. Create returns the field as the caller submitted it — option list and
// all — so only a read shows what the field now looks like to a consumer.
func requireStoredOptionsWithheld(t *testing.T, th *TestHelper, groupID, fieldID string) {
	t.Helper()
	field, err := th.service.GetPropertyField(th.Context, groupID, fieldID)
	require.NoError(t, err)
	requireOptionsWithheld(t, field)
}

// requireOptionsHidden asserts a masked field discloses neither option names nor
// how many options the field has.
func requireOptionsHidden(t *testing.T, field *model.PropertyField) {
	t.Helper()
	assert.Empty(t, field.Attrs[model.PropertyFieldAttributeOptions], "no option may be visible")
	assert.NotContains(t, field.Attrs, model.PropertyFieldAttributeOptionsCount, "the option count is controlled information too")
	assert.NotContains(t, field.Attrs, model.PropertyFieldAttributeOptionsOmitted)
}

// TestOptionsOmitted_ReadMasking covers the read-masking consumers of the
// inlined option list against a field with more options than a read inlines. The
// list is absent exactly as it is for a field with no options at all, so a
// consumer that cannot tell the two apart either leaks or over-hides.
func TestOptionsOmitted_ReadMasking(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "test-plugin"
	})
	rctxSource := RequestContextWithCallerID(th.Context, "test-plugin")

	// These masking paths read values rather than writing them, so the store is
	// the direct way to arrange a holding.
	assignValue := func(t *testing.T, fieldID, userID, optionID string) {
		t.Helper()
		encoded, err := json.Marshal(optionID)
		require.NoError(t, err)
		_, err = th.dbStore.PropertyValue().Create(&model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    fieldID,
			TargetType: "user",
			TargetID:   userID,
			Value:      encoded,
		})
		require.NoError(t, err)
	}

	newField := func(t *testing.T, name string, fieldType model.PropertyFieldType, accessMode string, options []any) *model.PropertyField {
		t.Helper()
		field, err := th.service.CreatePropertyField(rctxSource, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       name,
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:       accessMode,
				model.PropertyAttrsProtected:        true,
				model.PropertyFieldAttributeOptions: options,
			},
		})
		require.NoError(t, err)
		return field
	}

	t.Run("the source plugin sees the field's option count but not its options", func(t *testing.T) {
		options := oversizedOptions(false)
		field := newField(t, "select-source", model.PropertyFieldTypeSelect, model.PropertyAccessModeSharedOnly, options)

		retrieved, err := th.service.GetPropertyField(rctxSource, th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsWithheld(t, retrieved)
	})

	t.Run("a shared_only select field hides every option from a holder", func(t *testing.T) {
		options := oversizedOptions(false)
		field := newField(t, "select-shared", model.PropertyFieldTypeSelect, model.PropertyAccessModeSharedOnly, options)

		// The caller holds an option, so under the cap they would see that one
		// option back. Above it there is no list to intersect against.
		userID := model.NewId()
		assignValue(t, field.ID, userID, optionIDAt(t, options, 7))

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})

	t.Run("a shared_only rank field hides every option from a holder", func(t *testing.T) {
		options := oversizedOptions(true)
		field := newField(t, "rank-shared", model.PropertyFieldTypeRank, model.PropertyAccessModeSharedOnly, options)

		// A rank holding at the top of the ladder: under the cap this caller would
		// see the whole ladder, which is exactly what must not leak here.
		userID := model.NewId()
		assignValue(t, field.ID, userID, optionIDAt(t, options, model.PropertyFieldMaxHydratedOptions))

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})

	t.Run("a shared_only rank field hides another user's value", func(t *testing.T) {
		options := oversizedOptions(true)
		field := newField(t, "rank-shared-value", model.PropertyFieldTypeRank, model.PropertyAccessModeSharedOnly, options)

		// The caller outranks the target, so under the cap the target's value would
		// be visible in full. With no ranks loaded there is no way to establish
		// that, and a masking path with missing data hides.
		callerID := model.NewId()
		assignValue(t, field.ID, callerID, optionIDAt(t, options, 900))
		targetID := model.NewId()
		assignValue(t, field.ID, targetID, optionIDAt(t, options, 3))

		values, err := th.service.SearchPropertyValues(RequestContextWithCallerID(th.Context, callerID), th.CPAGroupID, model.PropertyValueSearchOpts{
			FieldID:   field.ID,
			TargetIDs: []string{targetID},
			PerPage:   10,
		})
		require.NoError(t, err)
		assert.Empty(t, values, "the target's rank must not be visible on ranks that were never loaded")
	})

	t.Run("a source_only field hides every option and its count", func(t *testing.T) {
		options := oversizedOptions(false)
		field := newField(t, "select-source-only", model.PropertyFieldTypeSelect, model.PropertyAccessModeSourceOnly, options)

		userID := model.NewId()
		assignValue(t, field.ID, userID, optionIDAt(t, options, 1))

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		requireOptionsHidden(t, retrieved)
	})
}

// TestOptionsOmitted_ValueValidation covers value assignment to a field whose
// option list was withheld. The options are checked against the option rows, not
// against the list left out of the read, so the size of the field makes no
// difference to which values are accepted.
func TestOptionsOmitted_ValueValidation(t *testing.T) {
	th := Setup(t)
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, nil, group.ID))

	options := oversizedOptions(false)
	field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "select_oversized",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: options,
		},
	})
	require.NoError(t, err)
	requireStoredOptionsWithheld(t, th, group.ID, field.ID)

	t.Run("an option the field really has is accepted", func(t *testing.T) {
		encoded, mErr := json.Marshal(optionIDAt(t, options, 0))
		require.NoError(t, mErr)

		_, err = th.service.CreatePropertyValue(th.Context, &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      encoded,
		})
		require.NoError(t, err, "the option exists, so the size of the field must not block the value")
	})

	t.Run("an option the field does not have is refused", func(t *testing.T) {
		encoded, mErr := json.Marshal(model.NewId())
		require.NoError(t, mErr)

		_, err = th.service.CreatePropertyValue(th.Context, &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      encoded,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not exist")
	})
}

// TestOptionsOmitted_WithheldGuardOnLinkedField pins the withheld-options guard
// on a field that happens to be linked. That guard fires before the linked-field
// guard ever runs, so it has to refuse anything that supplies an option list and
// allow the read-modify-write that does not.
func TestOptionsOmitted_WithheldGuardOnLinkedField(t *testing.T) {
	th := Setup(t)
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "template-oversized",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: oversizedOptions(false),
		},
	})
	require.NoError(t, err)
	requireStoredOptionsWithheld(t, th, group.ID, template.ID)

	linked, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:       group.ID,
		Name:          "linked-oversized",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: model.NewPointer(template.ID),
	})
	require.NoError(t, err)
	requireStoredOptionsWithheld(t, th, group.ID, linked.ID)

	t.Run("a read-modify-write that supplies no options is allowed", func(t *testing.T) {
		field, gErr := th.service.GetPropertyField(th.Context, group.ID, linked.ID)
		require.NoError(t, gErr)
		field.Attrs["display_name"] = "Linked"

		updated, _, uErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, uErr)
		assert.Equal(t, "Linked", updated.Attrs["display_name"])
		requireOptionsWithheld(t, updated)
	})

	t.Run("supplying an option list is refused", func(t *testing.T) {
		field, gErr := th.service.GetPropertyField(th.Context, group.ID, linked.ID)
		require.NoError(t, gErr)
		field.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": model.NewId(), "name": "Local"},
		}

		_, _, uErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, uErr)
		assert.Contains(t, uErr.Error(), "option list of a field whose options were not loaded")
	})

	t.Run("supplying an empty option list changes nothing", func(t *testing.T) {
		// A client that read the field, saw no options, and normalised that to an
		// empty array. It asserts nothing, so it is neither refused nor obeyed —
		// obeying it would ask the store to delete every option the field derives.
		field, gErr := th.service.GetPropertyField(th.Context, group.ID, linked.ID)
		require.NoError(t, gErr)
		field.Attrs[model.PropertyFieldAttributeOptions] = []any{}

		_, _, uErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, uErr)
		requireStoredOptionsWithheld(t, th, group.ID, linked.ID)
	})

	t.Run("the template keeps every option throughout", func(t *testing.T) {
		field, gErr := th.service.GetPropertyField(th.Context, group.ID, template.ID)
		require.NoError(t, gErr)
		requireOptionsWithheld(t, field)
	})
}

// TestOptionsOmitted_DisplayNameBackfill pins that the CPA display-name backfill
// leaves an oversized field's options alone. It writes every field it touches
// back to the store, so it is the one place a lost withheld marker would show up
// as deleted options rather than as a rejected request.
func TestOptionsOmitted_DisplayNameBackfill(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "oversized_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: oversizedOptions(false),
		},
	})
	require.NoError(t, err)
	requireStoredOptionsWithheld(t, th, th.CPAGroupID, field.ID)
	require.Empty(t, field.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName])

	backfilled, _, err := th.service.MigrateBackfillCPADisplayName(request.EmptyContext(th.Context.Logger()))
	require.NoError(t, err)
	require.Equal(t, 1, backfilled)

	updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, field.ID)
	require.NoError(t, err)
	assert.Equal(t, "oversized_select", updated.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName])
	requireOptionsWithheld(t, updated)
}

// TestOptionsOmitted_PatchThenWrite drives the shape the field PATCH handlers
// produce — read the field, PropertyField.Patch a client patch onto it, write it
// back — against a field above the hydration cap. A supplied option list is
// refused, and a supplied empty one has to leave the field's options alone.
func TestOptionsOmitted_PatchThenWrite(t *testing.T) {
	th := Setup(t)
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	newOversizedField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       name,
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: oversizedOptions(false),
			},
		})
		require.NoError(t, err)
		requireStoredOptionsWithheld(t, th, group.ID, field.ID)
		return field
	}

	patched := func(t *testing.T, fieldID string, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		field, err := th.service.GetPropertyField(th.Context, group.ID, fieldID)
		require.NoError(t, err)
		field.Patch(&model.PropertyFieldPatch{Attrs: &attrs}, true)
		return field
	}

	patchAndUpdate := func(t *testing.T, fieldID string, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		_, _, err := th.service.UpdatePropertyField(th.Context, group.ID, patched(t, fieldID, attrs))
		require.NoError(t, err)

		updated, err := th.service.GetPropertyField(th.Context, group.ID, fieldID)
		require.NoError(t, err)
		return updated
	}

	t.Run("a supplied option list is refused, options intact", func(t *testing.T) {
		field := newOversizedField(t, "patch-replaces")

		_, _, err := th.service.UpdatePropertyField(th.Context, group.ID, patched(t, field.ID, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "Only Option"},
			},
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "option list of a field whose options were not loaded")
		requireStoredOptionsWithheld(t, th, group.ID, field.ID)
	})

	t.Run("a supplied empty option list leaves every option in place", func(t *testing.T) {
		field := newOversizedField(t, "patch-empty")

		updated := patchAndUpdate(t, field.ID, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{},
		})

		requireOptionsWithheld(t, updated)
	})

	t.Run("a patch that does not mention options leaves every option in place", func(t *testing.T) {
		field := newOversizedField(t, "patch-unrelated")

		updated := patchAndUpdate(t, field.ID, model.StringInterface{"display_name": "Renamed"})

		assert.Equal(t, "Renamed", updated.Attrs["display_name"])
		requireOptionsWithheld(t, updated)
	})
}
