// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// These cover what the field the caller hands in is and is not trusted for.
// Everything else about the options endpoints is driven through the API, where
// the handler reads the field itself and a test cannot hand it a stale one.
func TestFieldOptionsWritableField(t *testing.T) {
	th := Setup(t)

	newOption := func(name string) []*model.PropertyFieldOption {
		return []*model.PropertyFieldOption{{Name: name}}
	}

	t.Run("a change decided against a field read before an earlier change still lands", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)
		// The field as first read. Every option change is written under a
		// compare-and-swap on its UpdateAt, and this copy's is about to be out of
		// date -- which is what a read that went to a replica looks like.
		stale := *graph.field

		_, err := th.service.CreateFieldOptions(th.Context, &stale, newOption("Sea"))
		require.NoError(t, err)

		// Same stale copy again. The service re-reads the field it is about to swap
		// on, so this is not a lost race; before it did, this answered 409.
		_, err = th.service.CreateFieldOptions(th.Context, &stale, newOption("Land"))
		require.NoError(t, err)

		options, err := th.service.GetFieldOptions(th.Context, graph.field, 0, "", 100)
		require.NoError(t, err)
		names := make([]string, 0, len(options))
		for _, option := range options {
			names = append(names, option.Name)
		}
		require.ElementsMatch(t, []string{"Air", "Sea", "Land"}, names)
	})

	t.Run("a change is decided against the field as it is now, not as the caller read it", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)
		stale := *graph.field

		require.NoError(t, th.dbStore.PropertyField().Delete(graph.field.GroupID, graph.field.ID))

		// The caller's copy says the field is alive. The field is not, and an option
		// written to a deleted field is written where nothing will look for it.
		_, err := th.service.CreateFieldOptions(th.Context, &stale, newOption("Sea"))
		require.Error(t, err)
		require.ErrorContains(t, err, "has been deleted")

		_, err = th.service.DeleteFieldOptions(th.Context, &stale, graph.of("Air"))
		require.Error(t, err)
		require.ErrorContains(t, err, "has been deleted")
	})

	t.Run("a rank field's options are not writable one at a time", func(t *testing.T) {
		rank := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Clearance-" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"id": model.NewId(), "name": "Secret", "rank": 1},
			}},
		})

		// An option created here would carry no rank, which is the one state a rank
		// field's options may never be in: it makes the field unwritable through its
		// own option list and reads as covering nothing where a policy clamps.
		_, err := th.service.CreateFieldOptions(th.Context, rank, newOption("Top Secret"))
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")

		options, err := th.service.GetFieldOptions(th.Context, rank, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1, "reading a rank field's options is still allowed")

		// A caller that forgot a page size is told, rather than being handed an
		// empty page it would read as a field with no options.
		_, err = th.service.GetFieldOptions(th.Context, rank, 0, "", 0)
		require.Error(t, err)
		require.ErrorContains(t, err, "positive page size")

		_, _, err = th.service.UpdateFieldOptions(th.Context, rank, []*model.PropertyFieldOption{
			{ID: options[0].ID, Name: "Renamed"},
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")

		_, err = th.service.DeleteFieldOptions(th.Context, rank, []string{options[0].ID})
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")
	})
}

// A field's options are part of its definition, so who may read and change them
// is decided by the same rules that decide who may read and change the field.
// These drive the option methods with a caller that has no authority over the
// field, which is the case the two paths to a field's options could otherwise
// answer differently: stated as the field's own option list, every one of these
// changes is refused.
func TestFieldOptionsAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "owning-plugin" || pluginID == "other-plugin"
	})

	source := RequestContextWithCallerID(th.Context, "owning-plugin")
	other := RequestContextWithCallerID(th.Context, "other-plugin")
	admin := RequestContextWithCallerID(th.Context, model.CallerIDLocalAdmin)

	// A field carrying one option, in whatever state the subtest is about. Written
	// straight to the store, because these are states a caller is not allowed to
	// ask for: only a plugin's own field is protected, and only an administrator
	// hands a field an owners list.
	fieldWith := func(t *testing.T, groupID string, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": model.NewId(), "name": "Air"},
		}
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "Programs-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      attrs,
		})
	}

	protectedAttrs := func() model.StringInterface {
		return model.StringInterface{
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsSourcePluginID: "owning-plugin",
		}
	}

	// Every verb, so that none of them is the one left unguarded. Each takes the
	// field's own option, which is the only option any of these callers could name.
	changes := []struct {
		name string
		call func(rctx request.CTX, field *model.PropertyField, optionID string) error
	}{
		{"create", func(rctx request.CTX, field *model.PropertyField, _ string) error {
			_, err := th.service.CreateFieldOptions(rctx, field, []*model.PropertyFieldOption{{Name: "Sea-" + model.NewId()}})
			return err
		}},
		{"update", func(rctx request.CTX, field *model.PropertyField, optionID string) error {
			_, _, err := th.service.UpdateFieldOptions(rctx, field, []*model.PropertyFieldOption{{ID: optionID, Name: "Land-" + model.NewId()}})
			return err
		}},
		{"delete", func(rctx request.CTX, field *model.PropertyField, optionID string) error {
			_, err := th.service.DeleteFieldOptions(rctx, field, []string{optionID})
			return err
		}},
	}

	optionID := func(t *testing.T, field *model.PropertyField) string {
		t.Helper()
		options, err := th.service.GetFieldOptions(source, field, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1)
		return options[0].ID
	}

	t.Run("a protected field's options are the source plugin's alone to change", func(t *testing.T) {
		for _, change := range changes {
			t.Run(change.name, func(t *testing.T) {
				field := fieldWith(t, th.CPAGroupID, protectedAttrs())
				held := optionID(t, field)

				err := change.call(other, field, held)
				require.Error(t, err)
				require.ErrorIs(t, err, ErrAccessDenied)
				require.ErrorContains(t, err, "owning-plugin")

				// Not the administrator's either, which is what the field write path
				// answers: a protected field is the source plugin's schema.
				err = change.call(admin, field, held)
				require.Error(t, err)
				require.ErrorIs(t, err, ErrAccessDenied)

				require.NoError(t, change.call(source, field, held))
			})
		}
	})

	t.Run("an owner-managed field's options are a listed owner's to change", func(t *testing.T) {
		field := fieldWith(t, th.CPAGroupID, model.StringInterface{
			model.PropertyAttrsOwners: []any{
				map[string]any{"id": "owning-plugin", "type": model.PropertyOwnerTypePlugin},
			},
		})
		held := optionID(t, field)

		err := changes[0].call(other, field, held)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrAccessDenied)
		require.ErrorContains(t, err, "owner-managed")

		require.NoError(t, changes[0].call(source, field, held))
	})

	t.Run("options are listed to a caller the field's options are readable by", func(t *testing.T) {
		attrs := protectedAttrs()
		attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModeSourceOnly
		field := fieldWith(t, th.CPAGroupID, attrs)

		options, err := th.service.GetFieldOptions(source, field, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1)

		// The field read hands these two an option list that has been emptied, so
		// the rows behind it cannot answer in full either.
		//
		// An emptied page, not a missing one: a nil page serializes as null rather
		// than [], which a caller looping over the page cannot read, and it is what
		// a filter that builds its result by appending returns.
		options, err = th.service.GetFieldOptions(other, field, 0, "", 100)
		require.NoError(t, err)
		require.NotNil(t, options)
		require.Empty(t, options)

		options, err = th.service.GetFieldOptions(admin, field, 0, "", 100)
		require.NoError(t, err)
		require.NotNil(t, options)
		require.Empty(t, options)
	})

	t.Run("a public field's options are readable and writable as before", func(t *testing.T) {
		field := fieldWith(t, th.CPAGroupID, model.StringInterface{})

		options, err := th.service.GetFieldOptions(other, field, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1)
		require.NoError(t, changes[0].call(other, field, options[0].ID))
	})

	t.Run("a group nothing manages is not gated at all", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		field := fieldWith(t, group.ID, protectedAttrs())

		options, err := th.service.GetFieldOptions(other, field, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1)
		require.NoError(t, changes[0].call(other, field, options[0].ID))
	})
}

// The option list a field is written with can state the hierarchy between its
// options, which is the only way to create one in a single call. These drive the
// service rather than the API, because what a list means depends on the field as
// the store has it -- its type and its link -- and the interesting cases are the
// ones where that differs from what the request said.
func TestFieldOptionsFromFieldList(t *testing.T) {
	th := Setup(t)
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	// inlineOption builds one entry of a field's option list. Parents are named,
	// and an entry that names none says nothing about the options above it.
	inlineOption := func(name string, parents ...string) map[string]any {
		option := map[string]any{"name": name}
		if parents != nil {
			option["parents"] = parents
		}
		return option
	}

	field := func(fieldType model.PropertyFieldType, options ...map[string]any) *model.PropertyField {
		list := make([]any, 0, len(options))
		for _, option := range options {
			list = append(list, option)
		}
		created := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "Programs-" + model.NewId(),
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		if len(list) > 0 {
			created.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: list}
		}
		return created
	}

	// asFixture reads the identifiers a write assigned to the options it created,
	// so a test can ask about the hierarchy it described by name.
	asFixture := func(t *testing.T, written *model.PropertyField) *graphFixture {
		t.Helper()
		fixture := &graphFixture{field: written, ids: map[string]string{}}
		options, ok := written.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok, "the field carries no option list")
		for _, item := range options {
			option, ok := item.(map[string]any)
			require.True(t, ok)
			fixture.ids[option["name"].(string)] = option["id"].(string)
		}
		return fixture
	}

	t.Run("a whole hierarchy is created in one field write, naming options further down the list", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Fighter Jet", "Air"),
			inlineOption("Air"),
			inlineOption("F-18", "Fighter Jet"),
		))
		require.NoError(t, err)

		graph := asFixture(t, created)
		above, err := th.service.AncestorsOrSelf(th.Context, created, graph.of("F-18", "Air"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet", "Air"}, graph.named(above[graph.ids["F-18"]]))
		require.ElementsMatch(t, []string{"Air"}, graph.named(above[graph.ids["Air"]]))

		// The hierarchy is not part of what the field serves: an option reads back
		// without it, and the parents never became an attribute of their own.
		read, err := th.service.GetPropertyField(th.Context, group.ID, created.ID)
		require.NoError(t, err)
		for _, item := range read.Attrs[model.PropertyFieldAttributeOptions].([]any) {
			option := item.(map[string]any)
			require.NotContains(t, option, "parents", "option %q", option["name"])
		}
	})

	t.Run("a parent no option in the list is called is refused, naming both", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Sea"),
		))
		require.Error(t, err)
		require.ErrorContains(t, err, `index 1 is put under "Sea"`)
		require.ErrorContains(t, err, "no option called")

		// The reason has to reach the caller as a message parameter, not only as the
		// error's detail: the HTTP layer strips the detail from the response unless
		// the server is in developer mode. Rendered here with the parameters in place
		// of the translation, which is what the response carries.
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		require.Contains(t, appErr.SystemMessage(func(_ string, args ...any) string {
			return fmt.Sprintf("%v", args)
		}), "no option called")
	})

	t.Run("an option put under itself is refused", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air", "Air"),
		))
		require.Error(t, err)
		require.ErrorContains(t, err, "is put under itself")
	})

	t.Run("a cycle stated in one write is refused", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air", "Sea"),
			inlineOption("Sea", "Air"),
		))
		require.Error(t, err)
		require.ErrorContains(t, err, "below itself")
	})

	t.Run("parents on a field whose options form no hierarchy are refused", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeMultiselect,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Air"),
		))
		require.Error(t, err)
		require.ErrorContains(t, err, "form no hierarchy")
	})

	t.Run("a list that leaves out an option with something below it is refused", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Air"),
			inlineOption("F-18", "Fighter Jet"),
		))
		require.NoError(t, err)
		graph := asFixture(t, created)

		// Omitting an option from the list is how a field write deletes it, so leaving
		// out the middle of a chain asks for the removal the options endpoint refuses
		// by name. Refused the same way here, or F-18 would silently be left a root.
		without := func(names ...string) *model.PropertyField {
			list := make([]any, 0, len(names))
			for _, name := range names {
				list = append(list, map[string]any{"id": graph.ids[name], "name": name})
			}
			edited := *created
			edited.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: list}
			return &edited
		}

		_, _, err = th.service.UpdatePropertyField(th.Context, group.ID, without("Air", "F-18"))
		require.Error(t, err)
		require.ErrorContains(t, err, "leaves out option")
		require.ErrorContains(t, err, graph.ids["Fighter Jet"])
		require.ErrorContains(t, err, graph.ids["F-18"])

		// Nothing moved: the refusal happens before the write.
		above, err := th.service.AncestorsOrSelf(th.Context, created, graph.of("F-18"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet", "Air"}, graph.named(above[graph.ids["F-18"]]))

		// The whole branch in one write is the supported way, exactly as it is through
		// the options endpoint.
		updated, _, err := th.service.UpdatePropertyField(th.Context, group.ID, without("Air"))
		require.NoError(t, err)
		require.Len(t, asOptionSlice(updated.Attrs), 1)

		// Leaving out a leaf was never in question: put one back under Air, then write
		// a list without it, which is the read-modify-write a client actually performs.
		seaParents := []string{"Air"}
		_, err = th.service.CreateFieldOptions(th.Context, updated, []*model.PropertyFieldOption{
			{Name: "Sea", Parents: &seaParents},
		})
		require.NoError(t, err)

		reread, err := th.service.GetPropertyField(th.Context, group.ID, created.ID)
		require.NoError(t, err)
		require.Len(t, asOptionSlice(reread.Attrs), 2)

		edited := *reread
		edited.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: []any{
			map[string]any{"id": graph.ids["Air"], "name": "Air"},
		}}
		final, _, err := th.service.UpdatePropertyField(th.Context, group.ID, &edited)
		require.NoError(t, err, "leaving out the leaf Sea is allowed")
		require.Len(t, asOptionSlice(final.Attrs), 1)
	})

	t.Run("a list that states no parents leaves the hierarchy alone, and one that does replaces them", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Air"),
			inlineOption("F-18", "Fighter Jet"),
		))
		require.NoError(t, err)
		graph := asFixture(t, created)

		// What a read gives a caller back: the same options, with nothing said about
		// the hierarchy. Writing it again must not flatten what it does not mention.
		read, err := th.service.GetPropertyField(th.Context, group.ID, created.ID)
		require.NoError(t, err)
		read.Name = "Renamed-" + model.NewId()
		updated, _, err := th.service.UpdatePropertyField(th.Context, group.ID, read)
		require.NoError(t, err)

		above, err := th.service.AncestorsOrSelf(th.Context, updated, graph.of("F-18"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet", "Air"}, graph.named(above[graph.ids["F-18"]]))

		// Stating a parent list replaces that option's parents and no others': F-18
		// moves up beside Fighter Jet, which keeps the parent it was never asked about.
		moved := *updated
		moved.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: []any{
			map[string]any{"id": graph.ids["Air"], "name": "Air"},
			map[string]any{"id": graph.ids["Fighter Jet"], "name": "Fighter Jet"},
			map[string]any{"id": graph.ids["F-18"], "name": "F-18", "parents": []string{"Air"}},
		}}
		updated, _, err = th.service.UpdatePropertyField(th.Context, group.ID, &moved)
		require.NoError(t, err)

		above, err = th.service.AncestorsOrSelf(th.Context, updated, graph.of("F-18", "Fighter Jet"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Air"}, graph.named(above[graph.ids["F-18"]]))
		require.ElementsMatch(t, []string{"Fighter Jet", "Air"}, graph.named(above[graph.ids["Fighter Jet"]]))

		// An empty list detaches, which is the only way a write can say "nothing
		// above this one".
		moved.Attrs[model.PropertyFieldAttributeOptions].([]any)[2].(map[string]any)["parents"] = []string{}
		updated, _, err = th.service.UpdatePropertyField(th.Context, group.ID, &moved)
		require.NoError(t, err)

		above, err = th.service.AncestorsOrSelf(th.Context, updated, graph.of("F-18"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18"}, graph.named(above[graph.ids["F-18"]]))
	})

	t.Run("an option list round-trips unchanged for a type with no hierarchy", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeMultiselect,
			map[string]any{"name": "Air", "color": "#111111", "emoji": "airplane"},
			map[string]any{"name": "Sea"},
		))
		require.NoError(t, err)

		read, err := th.service.GetPropertyField(th.Context, group.ID, created.ID)
		require.NoError(t, err)
		require.Equal(t, created.Attrs[model.PropertyFieldAttributeOptions], read.Attrs[model.PropertyFieldAttributeOptions])
	})

	t.Run("a field linking to a graph template cannot bring options of its own", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Air"),
		))
		require.NoError(t, err)
		graph := asFixture(t, template)

		linked := func(options ...map[string]any) *model.PropertyField {
			list := make([]any, 0, len(options))
			for _, option := range options {
				list = append(list, option)
			}
			created := field(model.PropertyFieldTypeGraph)
			created.ObjectType = model.PropertyFieldObjectTypeUser
			created.LinkedFieldID = &template.ID
			created.Type = ""
			if len(list) > 0 {
				created.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: list}
			}
			return created
		}

		// The request says nothing about the graph type -- the field takes it from the
		// template -- so a check reading the type off the request would miss this.
		_, err = th.service.CreatePropertyField(th.Context, linked(inlineOption("Land")))
		require.Error(t, err)
		require.ErrorContains(t, err, "cannot own options of its own")

		// Without a list of its own it serves the template's hierarchy.
		dependent, err := th.service.CreatePropertyField(th.Context, linked())
		require.NoError(t, err)
		above, err := th.service.AncestorsOrSelf(th.Context, dependent, graph.of("Fighter Jet"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet", "Air"}, graph.named(above[graph.ids["Fighter Jet"]]))
	})

	t.Run("a write may not take a name an option of a linked field already has", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeMultiselect,
			inlineOption("Air"),
		))
		require.NoError(t, err)

		dependent := field(model.PropertyFieldTypeMultiselect)
		dependent.ObjectType = model.PropertyFieldObjectTypeUser
		dependent.LinkedFieldID = &template.ID
		dependent.Type = ""
		dependent, err = th.service.CreatePropertyField(th.Context, dependent)
		require.NoError(t, err)

		// A field of a type with no hierarchy may own local options beside the ones it
		// inherits, which is the only way this collision arises.
		_, err = th.service.CreateFieldOptions(th.Context, dependent, []*model.PropertyFieldOption{{Name: "Land"}})
		require.NoError(t, err)

		renamed := *template
		renamed.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: []any{
			map[string]any{"id": asFixture(t, template).ids["Air"], "name": "Land"},
		}}
		_, _, err = th.service.UpdatePropertyField(th.Context, group.ID, &renamed)
		require.Error(t, err)
		require.ErrorContains(t, err, "local option of its own")
		require.ErrorContains(t, err, dependent.ID)

		// The same rename to a name nothing else serves is fine.
		renamed.Attrs[model.PropertyFieldAttributeOptions].([]any)[0].(map[string]any)["name"] = "Sea"
		_, _, err = th.service.UpdatePropertyField(th.Context, group.ID, &renamed)
		require.NoError(t, err)
	})

	t.Run("an option added to a template may not take a linked field's local name either", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeMultiselect,
			inlineOption("Air"),
		))
		require.NoError(t, err)

		dependent := field(model.PropertyFieldTypeMultiselect)
		dependent.ObjectType = model.PropertyFieldObjectTypeUser
		dependent.LinkedFieldID = &template.ID
		dependent.Type = ""
		dependent, err = th.service.CreatePropertyField(th.Context, dependent)
		require.NoError(t, err)

		_, err = th.service.CreateFieldOptions(th.Context, dependent, []*model.PropertyFieldOption{{Name: "Land"}})
		require.NoError(t, err)

		// Through the options endpoint this time: the two write paths answer the same
		// question the same way.
		_, err = th.service.CreateFieldOptions(th.Context, template, []*model.PropertyFieldOption{{Name: "Land"}})
		require.Error(t, err)
		require.ErrorContains(t, err, "local option of its own")

		// And the other direction, which is the half a field can answer on its own: a
		// local option may not take a name the field inherits.
		_, err = th.service.CreateFieldOptions(th.Context, dependent, []*model.PropertyFieldOption{{Name: "Air"}})
		require.Error(t, err)
		require.ErrorContains(t, err, "already has")
		require.ErrorContains(t, err, template.ID)
	})

	// The limits on a hierarchy are checked against the hierarchy as stored, and a
	// field being created has none -- every read behind the check answers empty and
	// what it measures is the list alone. These pin that the list is measured at
	// all: an early return for a field with no rows yet would leave a create as the
	// one way past every limit.
	t.Run("a list is held to the limits on the hierarchy it describes", func(t *testing.T) {
		chain := make([]map[string]any, 0, model.PropertyGraphMaxDepth+1)
		for i := 0; i <= model.PropertyGraphMaxDepth; i++ {
			if i == 0 {
				chain = append(chain, inlineOption("N0"))
				continue
			}
			chain = append(chain, inlineOption(fmt.Sprintf("N%d", i), fmt.Sprintf("N%d", i-1)))
		}
		_, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph, chain...))
		require.Error(t, err)
		require.ErrorContains(t, err, fmt.Sprintf("no chain may be longer than %d", model.PropertyGraphMaxDepth))

		fan := make([]map[string]any, 0, model.PropertyGraphMaxParentsPerOption+2)
		parents := make([]string, 0, model.PropertyGraphMaxParentsPerOption+1)
		for i := 0; i <= model.PropertyGraphMaxParentsPerOption; i++ {
			fan = append(fan, inlineOption(fmt.Sprintf("P%d", i)))
			parents = append(parents, fmt.Sprintf("P%d", i))
		}
		fan = append(fan, inlineOption("Child", parents...))
		_, err = th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph, fan...))
		require.Error(t, err)
		require.ErrorContains(t, err, fmt.Sprintf("no option may have more than %d", model.PropertyGraphMaxParentsPerOption))
	})

	t.Run("a cycle a list closes against the stored hierarchy is refused", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet", "Air"),
		))
		require.NoError(t, err)
		graph := asFixture(t, created)

		// Nothing in this list is cyclic on its own: putting Air under Fighter Jet
		// closes a cycle only together with the link already stored, which is what the
		// check has to read to see it.
		next := *created
		next.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: []any{
			map[string]any{"id": graph.ids["Air"], "name": "Air", "parents": []string{"Fighter Jet"}},
			map[string]any{"id": graph.ids["Fighter Jet"], "name": "Fighter Jet"},
		}}
		_, _, err = th.service.UpdatePropertyField(th.Context, group.ID, &next)
		require.Error(t, err)
		require.ErrorContains(t, err, "below itself")

		// Refused whole: the hierarchy is the one the field started with.
		above, err := th.service.AncestorsOrSelf(th.Context, created, graph.of("Fighter Jet"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"Fighter Jet", "Air"}, graph.named(above[graph.ids["Fighter Jet"]]))
	})

	t.Run("a hierarchy change reports the fields linking to the one that changed", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, field(model.PropertyFieldTypeGraph,
			inlineOption("Air"),
			inlineOption("Fighter Jet"),
		))
		require.NoError(t, err)
		graph := asFixture(t, template)

		dependent := field(model.PropertyFieldTypeGraph)
		dependent.ObjectType = model.PropertyFieldObjectTypeUser
		dependent.LinkedFieldID = &template.ID
		dependent.Type = ""
		dependent, err = th.service.CreatePropertyField(th.Context, dependent)
		require.NoError(t, err)

		// A dependent serves the template's hierarchy, so a change to it changes what
		// the dependent answers without touching a column of the dependent's row.
		// Reported alongside the write so its clients are told and its compiled
		// policies are dropped -- the same reason an option change reports them.
		withParent := func(current *model.PropertyField, parents ...string) *model.PropertyField {
			next := *current
			jet := map[string]any{"id": graph.ids["Fighter Jet"], "name": "Fighter Jet"}
			if parents != nil {
				jet["parents"] = parents
			}
			next.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": graph.ids["Air"], "name": "Air"},
				jet,
			}}
			return &next
		}

		_, propagated, _, err := th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{withParent(template, "Air")})
		require.NoError(t, err)
		require.Len(t, propagated, 1)
		require.Equal(t, dependent.ID, propagated[0].ID)

		// And a list restating the hierarchy it already had changes nothing, so
		// nobody is told anything.
		current, err := th.service.GetPropertyField(th.Context, group.ID, template.ID)
		require.NoError(t, err)
		_, propagated, _, err = th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{withParent(current, "Air")})
		require.NoError(t, err)
		require.Empty(t, propagated)
	})
}
