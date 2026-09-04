// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// The programs these tests build a hierarchy from: a root, an option below it,
// and two below that — the second of which is added after the fact, to a
// hierarchy other fields are already serving. Named rather than inlined because
// the same name is the reference key a parent is given by, the thing a listing is
// checked against, and what a subject's value resolves to.
const (
	airProgram        = "Air Program"
	fighterJetProgram = "Fighter Jet Program"
	f18Program        = "F-18 Program"
	f35Program        = "F-35 Program"
)

// setupGraphFieldTest starts a server that will accept a graph property field:
// the feature flag the type is gated on, and an Enterprise license, which the
// group below requires for every field and value operation.
//
// Where the option-endpoint tests in property_options_test.go register a property
// group of their own, these run against access_control — the group access rules
// are written over, and the only group whose property values are validated at
// all, since the validation hook is registered for it alone. A graph field is
// only useful where a value naming an option that does not exist is refused, so a
// fixture in a bare group would not be the thing a deployment runs.
func setupGraphFieldTest(t *testing.T) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
		cfg.FeatureFlags.PropertyFieldGraph = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	return th
}

// readGraphField reads one field of the access_control group back over HTTP.
// There is no single-field GET, so this asks for the object type's system-scoped
// fields and picks the one named. Every field these tests create is
// system-scoped, and the group's field limit bounds the answer to one page.
func readGraphField(t *testing.T, client *model.Client4, objectType, fieldID string) *model.PropertyField {
	t.Helper()

	fields, _, err := client.GetPropertyFields(context.Background(), model.AccessControlPropertyGroupName, objectType, model.PropertyFieldSearch{
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		PerPage:    model.AccessControlGroupFieldLimit,
	})
	require.NoError(t, err)

	for _, field := range fields {
		if field.ID == fieldID {
			return field
		}
	}
	require.FailNowf(t, "field not found", "no %s field %s in the access_control group", objectType, fieldID)
	return nil
}

// heldOptions marshals the value a graph field carries: the identifiers of the
// options the object holds.
func heldOptions(t *testing.T, optionIDs ...string) json.RawMessage {
	t.Helper()

	raw, err := json.Marshal(optionIDs)
	require.NoError(t, err)
	return raw
}

// inlineOptionNames returns the names in a field's inlined option list, which is
// the flat projection every client already understands. An absent list reads as
// no names; a caller that needs to tell that apart from a withheld one asks
// model.PropertyFieldOptionsOmitted.
func inlineOptionNames(t *testing.T, field *model.PropertyField) []string {
	t.Helper()

	raw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return nil
	}
	options, ok := raw.([]any)
	require.True(t, ok, "the option list should be a list, got %T", raw)

	names := make([]string, 0, len(options))
	for _, option := range options {
		entry, ok := option.(map[string]any)
		require.True(t, ok, "an option should be an object, got %T", option)
		names = append(names, entry["name"].(string))
	}
	return names
}

// TestGraphPropertyFieldAuthoring drives the whole authoring surface of a graph
// property field over HTTP, in the shape the driving use case has: a template
// field owns a hierarchy of programs, a user field and a channel field link to
// it, and a user and a channel are each tagged with the programs they hold.
//
// The subtests run in order against one fixture. They read each other's writes
// on purpose — a hierarchy authored in one place and served through two others
// is the property being checked, and it is only visible across several requests.
func TestGraphPropertyFieldAuthoring(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupGraphFieldTest(t)

	ctx := context.Background()
	admin := th.SystemAdminClient
	groupName := model.AccessControlPropertyGroupName

	// The whole hierarchy arrives in one request, with the first option naming a
	// parent that appears later in the same list.
	programs, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeTemplate, &model.PropertyField{
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeGraph,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{
				{"name": fighterJetProgram, "parents": []string{airProgram}},
				{"name": airProgram},
				{"name": f18Program, "parents": []string{fighterJetProgram}},
			},
		},
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Neither linked field says anything about the graph type: it is copied from
	// the template, which is why the feature gate has to look at the link source
	// and not only at the request.
	userPrograms, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeUser, &model.PropertyField{
		Name:          celSafeName(),
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &programs.ID,
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, model.PropertyFieldTypeGraph, userPrograms.Type)

	channelPrograms, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeChannel, &model.PropertyField{
		Name:          celSafeName(),
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &programs.ID,
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, model.PropertyFieldTypeGraph, channelPrograms.Type)

	// The two identifiers the value writes below name. They are the template's,
	// since the linked fields own no part of the hierarchy.
	owned, resp, err := admin.GetPropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, 0, "", model.PropertyFieldOptionsMaxPerRequest)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Len(t, owned, 3)
	f18ID := optionByName(t, owned, f18Program).ID
	fighterJetID := optionByName(t, owned, fighterJetProgram).ID

	// The two fields that serve the hierarchy without owning it. Every assertion
	// about derivation below is made for both of them.
	served := []struct {
		objectType string
		fieldID    string
	}{
		{model.PropertyFieldObjectTypeUser, userPrograms.ID},
		{model.PropertyFieldObjectTypeChannel, channelPrograms.ID},
	}

	t.Run("the hierarchy is served through both linked fields, and is theirs to read only", func(t *testing.T) {
		for _, option := range owned {
			assert.False(t, option.ReadOnly, "the field that owns %q may edit it", option.Name)
		}

		for _, tc := range served {
			t.Run(tc.objectType, func(t *testing.T) {
				listed, resp, err := admin.GetPropertyFieldOptions(ctx, groupName, tc.objectType, tc.fieldID, 0, "", model.PropertyFieldOptionsMaxPerRequest)
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				require.Len(t, listed, 3)

				// The same options under the same identifiers, with the same
				// hierarchy, and none of them this field's to change.
				for _, option := range listed {
					assert.True(t, option.ReadOnly, "%q is the template's option, not this field's", option.Name)
				}
				assert.Empty(t, *optionByName(t, listed, airProgram).Parents)
				assert.Equal(t, []string{airProgram}, *optionByName(t, listed, fighterJetProgram).Parents)
				assert.Equal(t, []string{fighterJetProgram}, *optionByName(t, listed, f18Program).Parents)
				assert.Equal(t, f18ID, optionByName(t, listed, f18Program).ID)

				// Editing one through the field that only serves it is refused,
				// naming the field to go to instead.
				_, resp, err = admin.PatchPropertyFieldOptions(ctx, groupName, tc.objectType, tc.fieldID, []*model.PropertyFieldOption{
					{ID: f18ID, Name: "Renamed"},
				})
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
				assert.Contains(t, err.(*model.AppError).Message, programs.ID)

				// And the field's own inlined list carries the same options
				// flat: a client that knows nothing about hierarchies sees an
				// ordinary option list, with no parents in it.
				field := readGraphField(t, admin, tc.objectType, tc.fieldID)
				assert.ElementsMatch(t, []string{airProgram, fighterJetProgram, f18Program}, inlineOptionNames(t, field))
				for _, option := range field.Attrs[model.PropertyFieldAttributeOptions].([]any) {
					assert.NotContains(t, option.(map[string]any), "parents")
				}
			})
		}
	})

	t.Run("a user and a channel hold the programs they are tagged with", func(t *testing.T) {
		// Nothing about a value says which field owns the option it names.
		upserted, resp, err := admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, []model.PropertyValuePatchItem{{
			FieldID: userPrograms.ID,
			Value:   heldOptions(t, f18ID),
		}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, upserted, 1)

		_, resp, err = admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeChannel, th.BasicChannel.Id, []model.PropertyValuePatchItem{{
			FieldID: channelPrograms.ID,
			Value:   heldOptions(t, fighterJetID),
		}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Read back through the endpoint a client reads them through. Each object
		// holds the option identifiers it was given, and nothing resolved them to
		// names or to the options above them on the way in or out.
		stored, resp, err := admin.GetPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, stored, 1)
		assert.Equal(t, userPrograms.ID, stored[0].FieldID)
		assert.JSONEq(t, string(heldOptions(t, f18ID)), string(stored[0].Value))

		stored, resp, err = admin.GetPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeChannel, th.BasicChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, stored, 1)
		assert.Equal(t, channelPrograms.ID, stored[0].FieldID)
		assert.JSONEq(t, string(heldOptions(t, fighterJetID)), string(stored[0].Value))
	})

	t.Run("a value naming something the field has no option for is refused", func(t *testing.T) {
		for _, tc := range []struct {
			name  string
			value json.RawMessage
		}{
			{name: "an option identifier of nothing", value: heldOptions(t, model.NewId())},
			{name: "an option held twice", value: heldOptions(t, f18ID, f18ID)},
			{name: "a single option rather than a list", value: json.RawMessage(fmt.Sprintf("%q", f18ID))},
		} {
			t.Run(tc.name, func(t *testing.T) {
				_, resp, err := admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, []model.PropertyValuePatchItem{{
					FieldID: userPrograms.ID,
					Value:   tc.value,
				}})
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
				CheckErrorID(t, err, "app.property_value.validate.app_error")
			})
		}

		// The value the user did hold survived every refusal.
		stored, _, err := admin.GetPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		assert.JSONEq(t, string(heldOptions(t, f18ID)), string(stored[0].Value))
	})

	t.Run("an option added to the template is served by both linked fields without writing to either", func(t *testing.T) {
		before := make([]*model.PropertyField, len(served))
		for i, tc := range served {
			before[i] = readGraphField(t, admin, tc.objectType, tc.fieldID)
		}
		templateBefore := readGraphField(t, admin, model.PropertyFieldObjectTypeTemplate, programs.ID)

		created, resp, err := admin.CreatePropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, []*model.PropertyFieldOption{
			{Name: f35Program, Parents: &[]string{fighterJetProgram}},
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Len(t, created, 1)

		// Both linked fields serve the new option straight away. Nothing
		// propagated it to them: an option belongs to the field that owns it and
		// a field serving it derives its set at read time, so neither row was
		// written and neither UpdateAt moved. The template's did, which is how a
		// client paging on UpdateAt learns anything changed; a client that knows
		// only a linked field is told by that field's own update event instead.
		for i, tc := range served {
			listed, _, lErr := admin.GetPropertyFieldOptions(ctx, groupName, tc.objectType, tc.fieldID, 0, "", model.PropertyFieldOptionsMaxPerRequest)
			require.NoError(t, lErr)
			require.Len(t, listed, 4)
			added := optionByName(t, listed, f35Program)
			assert.True(t, added.ReadOnly)
			assert.Equal(t, []string{fighterJetProgram}, *added.Parents)

			after := readGraphField(t, admin, tc.objectType, tc.fieldID)
			assert.Equal(t, before[i].UpdateAt, after.UpdateAt, "the %s field's row was written for an option it does not own", tc.objectType)
			assert.Contains(t, inlineOptionNames(t, after), f35Program, "the %s field's inlined list should carry the new option", tc.objectType)
		}

		templateAfter := readGraphField(t, admin, model.PropertyFieldObjectTypeTemplate, programs.ID)
		assert.Greater(t, templateAfter.UpdateAt, templateBefore.UpdateAt)
	})

	t.Run("a payload is refused by the index of the item at fault and the reason", func(t *testing.T) {
		_, resp, err := admin.CreatePropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, []*model.PropertyFieldOption{
			{Name: "Sea Program"},
			{Name: "Frigate Program", Parents: &[]string{"Naval Program"}},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Both halves have to reach the caller: which item to fix, and what is
		// wrong with it. Asserted on Message because the HTTP layer strips the
		// detailed error unless the server is in developer mode.
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Contains(t, appErr.Message, "at index 1")
		assert.Contains(t, appErr.Message, `"Naval Program"`)

		// One transaction, so the item before the bad one was not written either.
		listed, _, lErr := admin.GetPropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, 0, "", model.PropertyFieldOptionsMaxPerRequest)
		require.NoError(t, lErr)
		assert.ElementsMatch(t, []string{airProgram, fighterJetProgram, f18Program, f35Program}, optionNames(listed))
	})
}

// TestGraphPropertyFieldAboveHydrationCutoff covers a graph field with more
// options than a read inlines, which is the state the feature is designed for
// rather than an edge case: the hierarchies it exists to carry run to thousands
// of options, against a cutoff of model.PropertyFieldMaxHydratedOptions.
//
// Above it a field reads back with its option list withheld, so a caller holds
// no list to write back and the field-blob write path refuses one — while the
// options endpoints, which address one option at a time and never need the whole
// list, keep working. Both halves are asserted here because no other coverage
// reaches the pair end to end.
//
// The subtests share one fixture, and the one that exercises the options
// endpoints puts back what it takes so the option count the others assert on
// holds throughout.
func TestGraphPropertyFieldAboveHydrationCutoff(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupGraphFieldTest(t)

	ctx := context.Background()
	admin := th.SystemAdminClient
	groupName := model.AccessControlPropertyGroupName

	// One option past the cutoff: a root with model.PropertyFieldMaxHydratedOptions
	// options directly below it.
	options := make([]map[string]any, 0, model.PropertyFieldMaxHydratedOptions+1)
	options = append(options, map[string]any{"name": airProgram})
	for i := range model.PropertyFieldMaxHydratedOptions {
		options = append(options, map[string]any{
			"name":    fmt.Sprintf("Program %04d", i),
			"parents": []string{airProgram},
		})
	}

	programs, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeTemplate, &model.PropertyField{
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeGraph,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: options,
		},
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	userPrograms, resp, err := admin.CreatePropertyField(ctx, groupName, model.PropertyFieldObjectTypeUser, &model.PropertyField{
		Name:          celSafeName(),
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &programs.ID,
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// requireWithheld asserts a field still reports the option count it should
	// and still declines to inline the list.
	requireWithheld := func(t *testing.T, objectType, fieldID string, count int) {
		t.Helper()
		field := readGraphField(t, admin, objectType, fieldID)
		assert.True(t, model.PropertyFieldOptionsOmitted(field.Attrs), "the option list should be withheld, not absent")
		assert.NotContains(t, field.Attrs, model.PropertyFieldAttributeOptions)
		// options_count arrives as a JSON number, so it is compared by value
		// rather than by type.
		assert.EqualValues(t, count, field.Attrs[model.PropertyFieldAttributeOptionsCount])
	}

	t.Run("the field reads back with its options counted rather than listed", func(t *testing.T) {
		// Both the field that owns the options and the field that only serves
		// them: the cutoff is about the size of the answer, not about ownership.
		requireWithheld(t, model.PropertyFieldObjectTypeTemplate, programs.ID, model.PropertyFieldMaxHydratedOptions+1)
		requireWithheld(t, model.PropertyFieldObjectTypeUser, userPrograms.ID, model.PropertyFieldMaxHydratedOptions+1)
	})

	t.Run("the field blob refuses an option list it cannot have been built from", func(t *testing.T) {
		_, resp, err := admin.PatchPropertyField(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{{"name": f18Program}},
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.property_field.update.options_withheld.app_error")

		// Nothing was applied, and in particular nothing was deleted: the list
		// the caller sent named one option out of a thousand and one.
		requireWithheld(t, model.PropertyFieldObjectTypeTemplate, programs.ID, model.PropertyFieldMaxHydratedOptions+1)
	})

	t.Run("the field is otherwise editable", func(t *testing.T) {
		// Degrading rather than erroring means the field is not stuck: everything
		// about it except its option list still writes, which is what keeps a
		// hierarchy this size correctable.
		displayName := "Programs"
		updated, resp, err := admin.PatchPropertyField(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{model.PropertyFieldAttrDisplayName: displayName},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, displayName, updated.Attrs[model.PropertyFieldAttrDisplayName])
		requireWithheld(t, model.PropertyFieldObjectTypeTemplate, programs.ID, model.PropertyFieldMaxHydratedOptions+1)
	})

	t.Run("the options endpoints work on the same field", func(t *testing.T) {
		// A page at a time, in creation order, with each option's parents inline
		// — the read that reconstructs a hierarchy nothing can inline.
		var listed []*model.PropertyFieldOption
		var cursorCreateAt int64
		var cursorID string
		for {
			page, resp, pErr := admin.GetPropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, cursorCreateAt, cursorID, model.PropertyFieldOptionsMaxPerRequest)
			require.NoError(t, pErr)
			CheckOKStatus(t, resp)
			if len(page) == 0 {
				break
			}
			listed = append(listed, page...)
			last := page[len(page)-1]
			cursorCreateAt, cursorID = last.CreateAt, last.ID
		}
		require.Len(t, listed, model.PropertyFieldMaxHydratedOptions+1)
		assert.Equal(t, []string{airProgram}, *optionByName(t, listed, "Program 0000").Parents)

		// A parent is named, and the name resolves against the field's option
		// rows — the caller could not have read the list it is naming into.
		created, resp, err := admin.CreatePropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, []*model.PropertyFieldOption{
			{Name: f18Program, Parents: &[]string{"Program 0500"}},
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Len(t, created, 1)
		assert.Equal(t, []string{"Program 0500"}, *created[0].Parents)
		requireWithheld(t, model.PropertyFieldObjectTypeTemplate, programs.ID, model.PropertyFieldMaxHydratedOptions+2)

		// And so does a change to one, and a removal.
		updated, resp, err := admin.PatchPropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, []*model.PropertyFieldOption{
			{ID: created[0].ID, Name: f35Program, Parents: &[]string{"Program 0501"}},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, updated, 1)
		assert.Equal(t, f35Program, updated[0].Name)
		assert.Equal(t, []string{"Program 0501"}, *updated[0].Parents)

		resp, err = admin.DeletePropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeTemplate, programs.ID, []string{created[0].ID})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		requireWithheld(t, model.PropertyFieldObjectTypeTemplate, programs.ID, model.PropertyFieldMaxHydratedOptions+1)
	})

	t.Run("a value naming an option no read ever listed is accepted", func(t *testing.T) {
		// The check behind a value write reads the option rows rather than the
		// field's inlined list, so an option the cutoff hid is still an option a
		// subject can hold. Were it to read the list, every value on a field this
		// size would be refused as naming nothing.
		page, _, err := admin.GetPropertyFieldOptions(ctx, groupName, model.PropertyFieldObjectTypeUser, userPrograms.ID, 0, "", model.PropertyFieldOptionsMaxPerRequest)
		require.NoError(t, err)
		require.Len(t, page, model.PropertyFieldOptionsMaxPerRequest)
		held := page[len(page)-1]

		upserted, resp, err := admin.PatchPropertyValues(ctx, groupName, model.PropertyFieldObjectTypeUser, th.BasicUser.Id, []model.PropertyValuePatchItem{{
			FieldID: userPrograms.ID,
			Value:   heldOptions(t, held.ID),
		}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, upserted, 1)
		assert.JSONEq(t, string(heldOptions(t, held.ID)), string(upserted[0].Value))
	})
}
