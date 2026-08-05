// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// graphSharedOnlyHelper owns a shared_only graph field on the access-controlled
// group, so the read paths under test run the hook rather than passing values
// through.
type graphSharedOnlyHelper struct {
	th         *TestHelper
	rctxSource request.CTX
}

func setupGraphSharedOnly(t *testing.T) *graphSharedOnlyHelper {
	t.Helper()
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "test-plugin"
	})
	return &graphSharedOnlyHelper{th: th, rctxSource: RequestContextWithCallerID(th.Context, "test-plugin")}
}

// newField creates a shared_only graph field from options given as option name ->
// parent names, and reports the identifier each name was given.
func (h *graphSharedOnlyHelper) newField(t *testing.T, name string, parents map[string][]string, names ...string) (*model.PropertyField, map[string]string) {
	t.Helper()

	options := make([]any, 0, len(names))
	for _, optionName := range names {
		option := map[string]any{"name": optionName}
		if len(parents[optionName]) > 0 {
			option["parents"] = parents[optionName]
		}
		options = append(options, option)
	}

	field, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:    h.th.CPAGroupID,
		Name:       name,
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode:       model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:        true,
			model.PropertyFieldAttributeOptions: options,
		},
	})
	require.NoError(t, err)

	return field, optionIDsByName(t, field)
}

// optionIDsByName reports the identifier each of a field's options was given.
func optionIDsByName(t *testing.T, field *model.PropertyField) map[string]string {
	t.Helper()
	stored, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
	require.True(t, ok, "the field should read back with its options")

	ids := make(map[string]string, len(stored))
	for _, option := range stored {
		option, ok := option.(map[string]any)
		require.True(t, ok)
		ids[option["name"].(string)] = option["id"].(string)
	}
	return ids
}

// assign marks a user with the given options. It writes through the store rather
// than the service so that a test can assign an option the field does not have,
// which the write path exists to refuse.
func (h *graphSharedOnlyHelper) assign(t *testing.T, fieldID, userID string, optionIDs ...string) *model.PropertyValue {
	t.Helper()
	encoded, err := json.Marshal(optionIDs)
	require.NoError(t, err)

	value, err := h.th.dbStore.PropertyValue().Create(&model.PropertyValue{
		GroupID:    h.th.CPAGroupID,
		FieldID:    fieldID,
		TargetType: "user",
		TargetID:   userID,
		Value:      encoded,
	})
	require.NoError(t, err)
	return value
}

// visibleOptions reads a value back as the given caller and reports the options
// they were shown, or nil when the value was hidden from them entirely.
func (h *graphSharedOnlyHelper) visibleOptions(t *testing.T, callerID string, value *model.PropertyValue) []string {
	t.Helper()

	retrieved, err := h.th.service.GetPropertyValue(RequestContextWithCallerID(h.th.Context, callerID), h.th.CPAGroupID, value.ID)
	require.NoError(t, err)
	if retrieved == nil {
		return nil
	}

	var optionIDs []string
	require.NoError(t, json.Unmarshal(retrieved.Value, &optionIDs))
	return optionIDs
}

// listedOptions lists one page of a field's options as the given caller, from the
// option rows rather than from the list a field read carries inline.
func (h *graphSharedOnlyHelper) listedOptions(t *testing.T, callerID string, field *model.PropertyField, cursorCreateAt int64, cursorID string, perPage int) []*model.PropertyFieldOption {
	t.Helper()

	options, err := h.th.service.GetFieldOptions(RequestContextWithCallerID(h.th.Context, callerID), field, cursorCreateAt, cursorID, perPage)
	require.NoError(t, err)
	require.NotNil(t, options, "a page nothing is left in is an empty page, never nothing at all")
	return options
}

// listedNames reduces a page of options to the names it reported.
func listedNames(options []*model.PropertyFieldOption) []string {
	names := make([]string, 0, len(options))
	for _, option := range options {
		names = append(names, option.Name)
	}
	return names
}

// inlineOptionNames reports the option names a field read carried inline, which is
// empty for a field whose list was hidden or withheld.
func inlineOptionNames(t *testing.T, field *model.PropertyField) []string {
	t.Helper()

	inline, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return nil
	}
	options, ok := inline.([]any)
	require.True(t, ok)

	names := make([]string, 0, len(options))
	for _, option := range options {
		option, ok := option.(map[string]any)
		require.True(t, ok)
		names = append(names, option["name"].(string))
	}
	return names
}

// namesOf turns identifiers back into option names, so a failed assertion reads
// as the hierarchy the test wrote.
func namesOf(ids map[string]string, optionIDs []string) []string {
	byID := make(map[string]string, len(ids))
	for name, id := range ids {
		byID[id] = name
	}
	names := make([]string, 0, len(optionIDs))
	for _, id := range optionIDs {
		names = append(names, byID[id])
	}
	return names
}

// programHierarchy is the driving use case:
//
//	Air Program ── Fighter Jet Program ── F-18 Program
//
// plus an unrelated Sea Program.
var programHierarchy = map[string][]string{
	"Fighter Jet Program": {"Air Program"},
	"F-18 Program":        {"Fighter Jet Program"},
}

var programNames = []string{"Air Program", "Fighter Jet Program", "F-18 Program", "Sea Program"}

// TestGraphSharedOnly_Value covers what a caller is shown of another user's graph
// values on a shared_only field: the hierarchy decides it, rather than the exact
// option match select and multiselect fields use.
func TestGraphSharedOnly_Value(t *testing.T) {
	h := setupGraphSharedOnly(t)
	field, ids := h.newField(t, "programs-value", programHierarchy, programNames...)

	t.Run("a caller above the target's option sees it as it stands", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Air Program"])
		target := h.assign(t, field.ID, model.NewId(), ids["Fighter Jet Program"])

		assert.Equal(t, []string{"Fighter Jet Program"}, namesOf(ids, h.visibleOptions(t, caller, target)))
	})

	t.Run("a caller below the target's option sees their own part of it", func(t *testing.T) {
		// Alice holds F-18 and Bob is marked with the whole Fighter Jet program.
		// She learns that they have F-18 in common, and nothing about the rest of
		// the program.
		alice := model.NewId()
		h.assign(t, field.ID, alice, ids["F-18 Program"])
		bob := h.assign(t, field.ID, model.NewId(), ids["Fighter Jet Program"])

		assert.Equal(t, []string{"F-18 Program"}, namesOf(ids, h.visibleOptions(t, alice, bob)))
	})

	t.Run("a caller on an unrelated branch sees nothing", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Sea Program"])
		target := h.assign(t, field.ID, model.NewId(), ids["Fighter Jet Program"])

		assert.Nil(t, h.visibleOptions(t, caller, target))
	})

	t.Run("a caller holding nothing for the field sees nothing", func(t *testing.T) {
		target := h.assign(t, field.ID, model.NewId(), ids["Air Program"])

		assert.Nil(t, h.visibleOptions(t, model.NewId(), target))
	})

	t.Run("each of the target's options is answered on its own", func(t *testing.T) {
		// One option the caller covers, one they hold below, and one they have no
		// claim to at all — which drops out without taking the others with it.
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["F-18 Program"])
		target := h.assign(t, field.ID, model.NewId(),
			ids["F-18 Program"], ids["Air Program"], ids["Sea Program"])

		assert.ElementsMatch(t, []string{"F-18 Program"}, namesOf(ids, h.visibleOptions(t, caller, target)))
	})

	t.Run("an option the field no longer has shows nothing", func(t *testing.T) {
		// A value may outlive the option it names, and a stale identifier resolves
		// to nothing in the hierarchy — so it is covered by nobody, including a
		// caller marked with the root.
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Air Program"])
		target := h.assign(t, field.ID, model.NewId(), model.NewId())

		assert.Nil(t, h.visibleOptions(t, caller, target))
	})

	t.Run("a value that cannot be read as a set of options shows nothing", func(t *testing.T) {
		// Nothing the write path accepts looks like this, but a masking path that
		// fell through on a value it could not parse would hand it over whole.
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Air Program"])

		malformed, err := h.th.dbStore.PropertyValue().Create(&model.PropertyValue{
			GroupID:    h.th.CPAGroupID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"Air Program"`),
		})
		require.NoError(t, err)

		retrieved, err := h.th.service.GetPropertyValue(RequestContextWithCallerID(h.th.Context, caller), h.th.CPAGroupID, malformed.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("a caller with unrestricted read access is not masked at all", func(t *testing.T) {
		// Masking is about what somebody else may see. The source plugin reads back
		// what it wrote, including two options with nothing in common.
		target := h.assign(t, field.ID, model.NewId(), ids["Air Program"], ids["Sea Program"])

		assert.ElementsMatch(t, []string{"Air Program", "Sea Program"},
			namesOf(ids, h.visibleOptions(t, "test-plugin", target)))
	})
}

// TestGraphSharedOnly_ValueMultiParent covers the shape a hierarchy has once an
// option can be reached two ways, which is the whole point of a graph over a
// ladder.
func TestGraphSharedOnly_ValueMultiParent(t *testing.T) {
	h := setupGraphSharedOnly(t)

	//	Air ─┬─ Fighter Jet ── F-18
	//	     └───────────────────┘
	field, ids := h.newField(t, "programs-multiparent", map[string][]string{
		"Fighter Jet": {"Air"},
		"F-18":        {"Air", "Fighter Jet"},
	}, "Air", "Fighter Jet", "F-18")

	t.Run("an option reachable two ways is shown once, and only where nothing above it is shown", func(t *testing.T) {
		// The caller holds both options below Air. Descending from Air stops at
		// Fighter Jet down one branch and at F-18 down the other, and Fighter Jet
		// already accounts for F-18.
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Fighter Jet"], ids["F-18"])
		target := h.assign(t, field.ID, model.NewId(), ids["Air"])

		assert.Equal(t, []string{"Fighter Jet"}, namesOf(ids, h.visibleOptions(t, caller, target)))
	})

	t.Run("an option reached down two branches is not reported twice", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["F-18"])
		target := h.assign(t, field.ID, model.NewId(), ids["Air"])

		assert.Equal(t, []string{"F-18"}, namesOf(ids, h.visibleOptions(t, caller, target)))
	})
}

// TestGraphSharedOnly_ValueLinkedField covers masking on the shape the feature
// ships in: the hierarchy is defined once on a template, and the field users are
// marked through links to it. The values are the linked field's while the options
// and their parent links are the template's, so masking that resolved the
// hierarchy against the field holding the values would find every option
// unrelated to every other and hide everything.
func TestGraphSharedOnly_ValueLinkedField(t *testing.T) {
	h := setupGraphSharedOnly(t)

	template, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:    h.th.CPAGroupID,
		Name:       "programs-template",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "Air Program"},
				map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
				map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
			},
		},
	})
	require.NoError(t, err)
	ids := optionIDsByName(t, template)

	// The type and the security attributes both come from the template.
	linked, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:       h.th.CPAGroupID,
		Name:          "programs-linked",
		Type:          model.PropertyFieldTypeText,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
	})
	require.NoError(t, err)
	require.Equal(t, model.PropertyFieldTypeGraph, linked.Type)
	require.Equal(t, model.PropertyAccessModeSharedOnly, linked.Attrs[model.PropertyAttrsAccessMode])

	caller := model.NewId()
	h.assign(t, linked.ID, caller, ids["F-18 Program"])
	target := h.assign(t, linked.ID, model.NewId(), ids["Fighter Jet Program"])

	assert.Equal(t, []string{"F-18 Program"}, namesOf(ids, h.visibleOptions(t, caller, target)))
}

// TestGraphSharedOnly_ValueOptionsOmitted covers a graph field with more options
// than a read inlines, which is the size this field type exists for rather than
// an edge case. The other shared_only paths intersect against the inlined option
// list and have to hide when it is withheld; this one reads the hierarchy from the
// option rows and is unaffected.
func TestGraphSharedOnly_ValueOptionsOmitted(t *testing.T) {
	h := setupGraphSharedOnly(t)

	// One chain of three at the front, and filler past the cap behind it.
	options := make([]any, 0, model.PropertyFieldMaxHydratedOptions+1)
	options = append(options,
		map[string]any{"name": "Air Program"},
		map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
		map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
	)
	for i := len(options); i <= model.PropertyFieldMaxHydratedOptions; i++ {
		options = append(options, map[string]any{"name": fmt.Sprintf("Program %04d", i)})
	}

	field, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:    h.th.CPAGroupID,
		Name:       "programs-oversized",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode:       model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:        true,
			model.PropertyFieldAttributeOptions: options,
		},
	})
	require.NoError(t, err)
	ids := optionIDsByName(t, field)

	// Read as the source plugin, which is the only caller a shared_only field
	// shows an option count to at all: what this asserts is that the field is over
	// the cap, not what a masked read makes of it.
	stored, err := h.th.service.GetPropertyField(h.rctxSource, h.th.CPAGroupID, field.ID)
	require.NoError(t, err)
	requireOptionsWithheld(t, stored)

	caller := model.NewId()
	h.assign(t, field.ID, caller, ids["F-18 Program"])
	target := h.assign(t, field.ID, model.NewId(), ids["Fighter Jet Program"])

	assert.Equal(t, []string{"F-18 Program"}, namesOf(ids, h.visibleOptions(t, caller, target)),
		"the hierarchy comes from the option rows, so the size of the field changes nothing")
}

// TestGraphSharedOnly_OptionList covers what a caller is shown when they list a
// shared_only graph field's options: the options they cover, which is the rule the
// same field's values are masked by. This is the surface a large hierarchy is read
// through, so it is the one that has to answer rather than hide.
func TestGraphSharedOnly_OptionList(t *testing.T) {
	h := setupGraphSharedOnly(t)
	field, ids := h.newField(t, "programs-options", programHierarchy, programNames...)

	t.Run("a caller is shown the option they hold and everything it is made of", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Fighter Jet Program"])

		assert.ElementsMatch(t, []string{"Fighter Jet Program", "F-18 Program"},
			listedNames(h.listedOptions(t, caller, field, 0, "", 100)),
			"neither what sits above the caller's own option nor a branch beside it")
	})

	t.Run("a caller holding the root is shown its whole branch", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Air Program"])

		assert.ElementsMatch(t, []string{"Air Program", "Fighter Jet Program", "F-18 Program"},
			listedNames(h.listedOptions(t, caller, field, 0, "", 100)),
			"the unrelated Sea Program is not below the root the caller holds")
	})

	t.Run("a caller holding a leaf is shown that option alone", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["F-18 Program"])

		assert.Equal(t, []string{"F-18 Program"}, listedNames(h.listedOptions(t, caller, field, 0, "", 100)))
	})

	t.Run("a caller holding nothing for the field is shown an empty list", func(t *testing.T) {
		assert.Empty(t, h.listedOptions(t, model.NewId(), field, 0, "", 100))
	})

	t.Run("an option is not shown what sits above it", func(t *testing.T) {
		// The parent is reported by name, and a caller holding an option exactly
		// covers nothing above it — so naming its parent would hand over the option
		// name the value masking is there to withhold.
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["F-18 Program"])

		masked := h.listedOptions(t, caller, field, 0, "", 100)
		require.Len(t, masked, 1)
		assert.Nil(t, masked[0].Parents)

		// The source plugin is told, which is what makes this masking rather than the
		// endpoint simply never reporting a hierarchy.
		for _, option := range h.listedOptions(t, "test-plugin", field, 0, "", 100) {
			if option.ID == ids["F-18 Program"] {
				require.NotNil(t, option.Parents)
				assert.Equal(t, []string{"Fighter Jet Program"}, *option.Parents)
			}
		}
	})

	t.Run("a caller with unrestricted read access is not masked at all", func(t *testing.T) {
		assert.ElementsMatch(t, programNames, listedNames(h.listedOptions(t, "test-plugin", field, 0, "", 100)))
	})
}

// TestGraphSharedOnly_OptionListPaged covers the listing across a page boundary. A
// caller pages until a page comes back short, so a page that came back short only
// because the caller may not see most of it would end the listing early — and every
// option they cover after that point would be unreachable.
func TestGraphSharedOnly_OptionListPaged(t *testing.T) {
	h := setupGraphSharedOnly(t)
	field, ids := h.newField(t, "programs-options-paged", programHierarchy, programNames...)

	// A listing is ordered by creation time and then identifier, and these options
	// were all written in one call — so which one leads is decided by identifier and
	// is not the order they were given in. Hold an option that does not account for
	// whichever one leads, so that the first page of one option has to look past
	// something the caller may not see in order to find anything at all.
	order := listedNames(h.listedOptions(t, "test-plugin", field, 0, "", 100))
	require.Len(t, order, len(programNames))

	holding := "Fighter Jet Program"
	if order[0] == "Fighter Jet Program" || order[0] == "F-18 Program" {
		holding = "Sea Program"
	}
	covers := map[string][]string{
		"Fighter Jet Program": {"Fighter Jet Program", "F-18 Program"},
		"Sea Program":         {"Sea Program"},
	}[holding]

	var expected []string
	for _, name := range order {
		if slices.Contains(covers, name) {
			expected = append(expected, name)
		}
	}

	caller := model.NewId()
	h.assign(t, field.ID, caller, ids[holding])

	var names []string
	var cursorCreateAt int64
	var cursorID string
	for {
		page := h.listedOptions(t, caller, field, cursorCreateAt, cursorID, 1)
		if len(page) == 0 {
			break
		}
		require.Len(t, page, 1, "a page never holds more than the size asked for")
		names = append(names, page[0].Name)
		cursorCreateAt, cursorID = page[0].CreateAt, page[0].ID
		require.LessOrEqual(t, len(names), len(programNames), "the listing has to end")
	}

	assert.Equal(t, expected, names,
		"paging one option at a time reaches every option the caller covers, in the field's own order")
}

// TestGraphSharedOnly_OptionListOptionsOmitted covers the size this field type
// exists for: a hierarchy with more options than a field read inlines. The listing
// comes from the option rows, so it is unaffected — which matters because for such
// a field the listing is the only way to see the hierarchy at all.
func TestGraphSharedOnly_OptionListOptionsOmitted(t *testing.T) {
	h := setupGraphSharedOnly(t)

	// One chain of three at the front, and filler past the cap behind it.
	options := make([]any, 0, model.PropertyFieldMaxHydratedOptions+1)
	options = append(options,
		map[string]any{"name": "Air Program"},
		map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
		map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
	)
	for i := len(options); i <= model.PropertyFieldMaxHydratedOptions; i++ {
		options = append(options, map[string]any{"name": fmt.Sprintf("Program %04d", i)})
	}

	field, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:    h.th.CPAGroupID,
		Name:       "programs-options-oversized",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode:       model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:        true,
			model.PropertyFieldAttributeOptions: options,
		},
	})
	require.NoError(t, err)
	ids := optionIDsByName(t, field)

	stored, err := h.th.service.GetPropertyField(h.rctxSource, h.th.CPAGroupID, field.ID)
	require.NoError(t, err)
	requireOptionsWithheld(t, stored)

	caller := model.NewId()
	h.assign(t, field.ID, caller, ids["Fighter Jet Program"])

	assert.ElementsMatch(t, []string{"Fighter Jet Program", "F-18 Program"},
		listedNames(h.listedOptions(t, caller, field, 0, "", 200)),
		"the hierarchy comes from the option rows, so the size of the field changes nothing")

	// The field read has no list to filter at this size, and inventing one would put
	// the whole hierarchy on a field read. Hiding is the answer there; the listing
	// above is what answers instead.
	read, err := h.th.service.GetPropertyField(RequestContextWithCallerID(h.th.Context, caller), h.th.CPAGroupID, field.ID)
	require.NoError(t, err)
	requireOptionsHidden(t, read)
}

// TestGraphSharedOnly_FieldOptionList covers the option list a field read carries
// inline, which for a graph field small enough to have one is filtered by the same
// coverage rule as the listing and as the field's values.
func TestGraphSharedOnly_FieldOptionList(t *testing.T) {
	h := setupGraphSharedOnly(t)
	field, ids := h.newField(t, "programs-inline", programHierarchy, programNames...)

	inline := func(t *testing.T, callerID string) []string {
		t.Helper()
		read, err := h.th.service.GetPropertyField(RequestContextWithCallerID(h.th.Context, callerID), h.th.CPAGroupID, field.ID)
		require.NoError(t, err)
		return inlineOptionNames(t, read)
	}

	t.Run("a caller sees the options they cover, not only the ones they hold", func(t *testing.T) {
		caller := model.NewId()
		h.assign(t, field.ID, caller, ids["Fighter Jet Program"])

		assert.ElementsMatch(t, []string{"Fighter Jet Program", "F-18 Program"}, inline(t, caller))
	})

	t.Run("a caller holding nothing for the field sees no options", func(t *testing.T) {
		assert.Empty(t, inline(t, model.NewId()))
	})

	t.Run("a caller with unrestricted read access sees the whole list", func(t *testing.T) {
		read, err := h.th.service.GetPropertyField(h.rctxSource, h.th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.ElementsMatch(t, programNames, inlineOptionNames(t, read))
	})
}

// TestGraphSharedOnly_OptionListLinkedField covers the listing on the shape the
// feature ships in: the hierarchy is defined once on a template, and the fields
// users are marked through link to it. The options a linked field lists are the
// template's rows, flagged read-only, while the caller's own options are values on
// the linked field — so a filter that resolved the hierarchy against the field
// holding the values would find every option unrelated to every other and show
// nothing.
func TestGraphSharedOnly_OptionListLinkedField(t *testing.T) {
	h := setupGraphSharedOnly(t)

	template, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:    h.th.CPAGroupID,
		Name:       "programs-options-template",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "Air Program"},
				map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
				map[string]any{"name": "F-18 Program", "parents": []string{"Fighter Jet Program"}},
				map[string]any{"name": "Sea Program"},
			},
		},
	})
	require.NoError(t, err)
	ids := optionIDsByName(t, template)

	linked, err := h.th.service.CreatePropertyField(h.rctxSource, &model.PropertyField{
		GroupID:       h.th.CPAGroupID,
		Name:          "programs-options-linked",
		Type:          model.PropertyFieldTypeText,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
	})
	require.NoError(t, err)
	require.Equal(t, model.PropertyFieldTypeGraph, linked.Type)

	caller := model.NewId()
	h.assign(t, linked.ID, caller, ids["Fighter Jet Program"])

	shown := h.listedOptions(t, caller, linked, 0, "", 100)
	assert.ElementsMatch(t, []string{"Fighter Jet Program", "F-18 Program"}, listedNames(shown))
	for _, option := range shown {
		assert.True(t, option.ReadOnly, "the options belong to the template, so this field may not change them")
	}

	// Addressing the template itself shows nothing: the values that say what a
	// caller holds are the linked field's, and nobody holds a template's values.
	// Fail-closed, and the same answer the value masking gives.
	assert.Empty(t, h.listedOptions(t, caller, template, 0, "", 100))
}

// TestGraphSharedOnly_OptionListPageFilled covers the arithmetic of filling a page
// from more than one page of rows: that a full page is answered full even when the
// rows behind it were mostly invisible, that the surplus a filling read picks up is
// dropped rather than lost, and that paging on from what was shown neither skips an
// option nor repeats one.
//
// The options here sit under nothing, so a caller covers exactly what they hold.
// The hierarchy is not what is under test; the paging is.
func TestGraphSharedOnly_OptionListPageFilled(t *testing.T) {
	h := setupGraphSharedOnly(t)
	field, ids := h.newField(t, "programs-options-filled", nil,
		"Program A", "Program B", "Program C", "Program D")

	// A listing is ordered by creation time and then identifier, and these were
	// written in one call — so the order has to be read rather than assumed. Hold
	// everything but whichever option leads, so the first page of two must look
	// past a row it may not show and still come back full.
	order := listedNames(h.listedOptions(t, "test-plugin", field, 0, "", 100))
	require.Len(t, order, 4)

	caller := model.NewId()
	held := make([]string, 0, 3)
	for _, name := range order[1:] {
		held = append(held, ids[name])
	}
	h.assign(t, field.ID, caller, held...)

	first := h.listedOptions(t, caller, field, 0, "", 2)
	require.Len(t, first, 2, "a page is filled from the rows behind it, not answered short")
	assert.Equal(t, order[1:3], listedNames(first))

	// Continue from the last option shown. The option the filling read picked up
	// past the page size was dropped, so it has to come back here.
	second := h.listedOptions(t, caller, field, first[1].CreateAt, first[1].ID, 2)
	assert.Equal(t, order[3:], listedNames(second), "the surplus is dropped, not lost")

	last := second[len(second)-1]
	assert.Empty(t, h.listedOptions(t, caller, field, last.CreateAt, last.ID, 2),
		"and then the listing ends")
}
