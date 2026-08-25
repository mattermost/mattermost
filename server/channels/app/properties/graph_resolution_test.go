// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// graphFixture is a graph field whose options a test refers to by name.
type graphFixture struct {
	field *model.PropertyField
	ids   map[string]string
}

// of turns option names into the identifiers a caller of the resolution service
// passes, which is what a property value holds.
func (f *graphFixture) of(names ...string) []string {
	ids := make([]string, 0, len(names))
	for _, name := range names {
		ids = append(ids, f.ids[name])
	}
	return ids
}

// named turns identifiers back into option names, so a failed assertion reads as
// the hierarchy the test wrote.
func (f *graphFixture) named(ids []string) []string {
	byID := make(map[string]string, len(f.ids))
	for name, id := range f.ids {
		byID[id] = name
	}
	names := make([]string, 0, len(ids))
	for _, id := range ids {
		names = append(names, byID[id])
	}
	return names
}

// setupGraph creates a graph field owning one option per name, with parents given
// as child name -> parent names.
func setupGraph(t *testing.T, th *TestHelper, names []string, parents map[string][]string) *graphFixture {
	t.Helper()

	fixture := &graphFixture{ids: make(map[string]string, len(names))}
	options := make([]any, 0, len(names))
	for _, name := range names {
		fixture.ids[name] = model.NewId()
		options = append(options, map[string]any{"id": fixture.ids[name], "name": name})
	}

	fixture.field = th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    model.NewId(),
		Name:       "Programs-" + model.NewId(),
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{"options": options},
	})

	var edges []*model.PropertyOptionEdge
	for child, parentNames := range parents {
		for _, parent := range parentNames {
			edges = append(edges, &model.PropertyOptionEdge{
				FieldID:        fixture.field.ID,
				ChildOptionID:  fixture.ids[child],
				ParentOptionID: fixture.ids[parent],
			})
		}
	}
	require.NoError(t, th.dbStore.PropertyField().MutateOptions(fixture.field.GroupID, fixture.field.ID, fixture.field.UpdateAt, nil, edges, nil))

	return fixture
}

// setupWorkedExample builds A ─┬─ B ── C
//
//	└─ D
func setupWorkedExample(t *testing.T, th *TestHelper) *graphFixture {
	t.Helper()
	return setupGraph(t, th, []string{"A", "B", "C", "D"}, map[string][]string{
		"B": {"A"},
		"C": {"B"},
		"D": {"A"},
	})
}

func TestGraphAncestors(t *testing.T) {
	th := Setup(t)
	graph := setupWorkedExample(t, th)

	t.Run("options above, keyed by the option asked about", func(t *testing.T) {
		above, err := th.service.AncestorsOrSelf(th.Context, graph.field, graph.of("C", "D"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"C", "B", "A"}, graph.named(above[graph.ids["C"]]))
		require.ElementsMatch(t, []string{"D", "A"}, graph.named(above[graph.ids["D"]]))
	})

	t.Run("an option the field does not have is left out rather than reported alone", func(t *testing.T) {
		absent := model.NewId()
		above, err := th.service.AncestorsOrSelf(th.Context, graph.field, append(graph.of("C"), absent))
		require.NoError(t, err)
		require.Len(t, above, 1)
		require.NotContains(t, above, absent)
	})

	t.Run("a field of another type has no hierarchy to walk", func(t *testing.T) {
		multiselect := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Flat-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": []any{map[string]any{"id": model.NewId(), "name": "Air"}}},
		})

		_, err := th.service.AncestorsOrSelf(th.Context, multiselect, []string{model.NewId()})
		require.Error(t, err)
	})
}

func TestGraphClampToCoverage(t *testing.T) {
	th := Setup(t)

	t.Run("an option the holder covers stands, one they do not is replaced", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		// Alice holds F-18 and is being told about an object marked Fighter Jet.
		// She has no claim to the rest of the Fighter Jet program, so what she is
		// told is her own part of it.
		visible, err := th.service.clampToCoverage(th.Context, graph.field, graph.of("Fighter Jet"), graph.of("F-18"), nil)
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, graph.named(visible))

		// The other way round she covers it outright and it stands as it is.
		visible, err = th.service.clampToCoverage(th.Context, graph.field, graph.of("F-18"), graph.of("Fighter Jet"), nil)
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, graph.named(visible))

		// Including when it is exactly what she holds.
		visible, err = th.service.clampToCoverage(th.Context, graph.field, graph.of("F-18"), graph.of("F-18"), nil)
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, graph.named(visible))
	})

	t.Run("options are clamped one at a time", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18", "Sea"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		// One option covered outright, one replaced by what the holder covers below
		// it, and one with nothing covered below it at all -- which contributes
		// nothing rather than hiding the other two.
		visible, err := th.service.clampToCoverage(th.Context, graph.field,
			graph.of("F-18", "Air", "Sea"), graph.of("Fighter Jet"), nil)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"F-18", "Fighter Jet"}, graph.named(visible))
	})

	t.Run("nothing the holder covers leaves nothing to see", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Sea"}, map[string][]string{
			"Fighter Jet": {"Air"},
		})

		// A holder on a separate branch covers no part of the Air program, and the
		// answer is nothing at all rather than the option they hold.
		visible, err := th.service.clampToCoverage(th.Context, graph.field, graph.of("Fighter Jet"), graph.of("Sea"), nil)
		require.NoError(t, err)
		require.Empty(t, visible)

		// A holder of nothing is the same case, as is an object marked with
		// nothing.
		visible, err = th.service.clampToCoverage(th.Context, graph.field, graph.of("Air"), nil, nil)
		require.NoError(t, err)
		require.Empty(t, visible)

		visible, err = th.service.clampToCoverage(th.Context, graph.field, nil, graph.of("Air"), nil)
		require.NoError(t, err)
		require.Empty(t, visible)
	})

	t.Run("an option the field does not have is not visible to anyone", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{
			"Fighter Jet": {"Air"},
		})

		// A value naming an option that has since been deleted covers nothing and
		// has nothing below it, so a holder of the root is told nothing about it
		// -- the one holder who is told everything else.
		visible, err := th.service.clampToCoverage(th.Context, graph.field, []string{model.NewId()}, graph.of("Air"), nil)
		require.NoError(t, err)
		require.Empty(t, visible)

		// And a holder of an option the field does not have covers nothing.
		visible, err = th.service.clampToCoverage(th.Context, graph.field, graph.of("Air"), []string{model.NewId()}, nil)
		require.NoError(t, err)
		require.Empty(t, visible)
	})

	t.Run("a replacement reachable by two routes is reported once", func(t *testing.T) {
		//   Air ─┬─ Fighter Jet ─┬─ F-18
		//        └─ Carrier Air ─┘
		// Descending from Air reaches F-18 down both branches.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Carrier Air", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"Carrier Air": {"Air"},
			"F-18":        {"Fighter Jet", "Carrier Air"},
		})

		visible, err := th.service.clampToCoverage(th.Context, graph.field, graph.of("Air"), graph.of("F-18"), nil)
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, graph.named(visible))
	})

	t.Run("a replacement reports only the options nothing else in it accounts for", func(t *testing.T) {
		//   Air ─┬─ Fighter Jet ── F-18
		//        └─────────────────┘
		// F-18 hangs off Air directly as well as under Fighter Jet, so descending
		// from Air stops at both Fighter Jet and F-18 without either branch
		// noticing the other. Fighter Jet is above F-18, and a holder told about
		// Fighter Jet has been told about F-18 already.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Air", "Fighter Jet"},
		})

		visible, err := th.service.clampToCoverage(th.Context, graph.field, graph.of("Air"), graph.of("Fighter Jet", "F-18"), nil)
		require.NoError(t, err)
		require.Equal(t, []string{"Fighter Jet"}, graph.named(visible))
	})

	t.Run("a field of another type has no hierarchy to clamp against", func(t *testing.T) {
		multiselect := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Flat-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": []any{map[string]any{"id": model.NewId(), "name": "Air"}}},
		})

		visible, err := th.service.clampToCoverage(th.Context, multiselect, []string{"a"}, []string{"a"}, nil)
		require.Error(t, err)
		require.Empty(t, visible, "a refusal shows nothing, not the options it was asked about")
	})
}

func TestGraphWouldCreateCycle(t *testing.T) {
	th := Setup(t)

	edge := func(graph *graphFixture, child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{
			FieldID:        graph.field.ID,
			ChildOptionID:  graph.ids[child],
			ParentOptionID: graph.ids[parent],
		}
	}

	t.Run("an edge back up an existing chain", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		// Air under F-18 closes the chain it is already at the top of, two steps
		// away.
		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Air", "F-18"),
		}, nil)
		require.NoError(t, err)
		require.True(t, cycle)

		// A second parent for the lowest option does not.
		cycle, err = th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Air"),
		}, nil)
		require.NoError(t, err)
		require.False(t, cycle)
	})

	t.Run("two edges that are each fine and together are not", func(t *testing.T) {
		// Two separate chains, Air ── Fighter Jet and Sea ── Frigate. Hanging each
		// chain's top under the other's bottom joins them into a circle, and
		// neither edge does it alone.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Sea", "Frigate"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"Frigate":     {"Sea"},
		})

		for _, single := range []*model.PropertyOptionEdge{
			edge(graph, "Sea", "Fighter Jet"),
			edge(graph, "Air", "Frigate"),
		} {
			cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{single}, nil)
			require.NoError(t, err)
			require.False(t, cycle)
		}

		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Sea", "Fighter Jet"),
			edge(graph, "Air", "Frigate"),
		}, nil)
		require.NoError(t, err)
		require.True(t, cycle, "the two edges close a circle through both existing chains")
	})

	t.Run("an option under itself", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Air", "Air"),
		}, nil)
		require.NoError(t, err)
		require.True(t, cycle)
	})

	t.Run("branches that rejoin are not cycles", func(t *testing.T) {
		// Two routes from Air down to F-18 make F-18 reachable twice, which is a
		// diamond and perfectly ordinary.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Secret", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"Secret":      {"Air"},
		})

		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Fighter Jet"),
			edge(graph, "F-18", "Secret"),
		}, nil)
		require.NoError(t, err)
		require.False(t, cycle)
	})

	t.Run("nothing to add cannot create anything", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		cycle, err := th.service.WouldCreateCycle(graph.field, nil, nil)
		require.NoError(t, err)
		require.False(t, cycle)
	})

	t.Run("a link the same change removes is not in the way", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{"Fighter Jet": {"Air"}})

		// Turning a relationship round: Air below Fighter Jet is a cycle while the
		// link it reverses is still there, and is the ordinary act of re-parenting an
		// option once the change removes that link too.
		inverted := []*model.PropertyOptionEdge{edge(graph, "Air", "Fighter Jet")}
		cycle, err := th.service.WouldCreateCycle(graph.field, inverted, nil)
		require.NoError(t, err)
		require.True(t, cycle)

		cycle, err = th.service.WouldCreateCycle(graph.field, inverted, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		})
		require.NoError(t, err)
		require.False(t, cycle)
	})

	t.Run("a field of another type is refused, and refusing means rejecting", func(t *testing.T) {
		multiselect := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Flat-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})

		cycle, err := th.service.WouldCreateCycle(multiselect, []*model.PropertyOptionEdge{
			{FieldID: multiselect.ID, ChildOptionID: model.NewId(), ParentOptionID: model.NewId()},
		}, nil)
		require.Error(t, err)
		require.True(t, cycle, "a caller that drops the error must still reject the mutation")
	})
}

func TestGraphDepthAfterAdding(t *testing.T) {
	th := Setup(t)

	edge := func(graph *graphFixture, child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{
			FieldID:        graph.field.ID,
			ChildOptionID:  graph.ids[child],
			ParentOptionID: graph.ids[parent],
		}
	}

	t.Run("the chain an edge lands in the middle of", func(t *testing.T) {
		// Air ── Fighter Jet, and Bomber ── B-2 waiting to be attached.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Bomber", "B-2"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"B-2":         {"Bomber"},
		})

		// Two unattached options make a chain of two.
		depth, err := th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Bomber", "Air"),
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 3, depth, "Air, Bomber, B-2")

		// Hanging the bottom of one chain under the bottom of the other counts
		// both chains.
		depth, err = th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Bomber", "Fighter Jet"),
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 4, depth, "Air, Fighter Jet, Bomber, B-2")
	})

	t.Run("edges in one payload that chain onto each other", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18", "F-18C"}, nil)

		// None of these exist yet, so the depth is only right if the payload is
		// read as a whole.
		depth, err := th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18C", "F-18"),
			edge(graph, "Fighter Jet", "Air"),
			edge(graph, "F-18", "Fighter Jet"),
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 4, depth)
	})

	t.Run("the longest chain, not one of them", func(t *testing.T) {
		// Air ─┬─ Fighter Jet ── F-18
		//      └─ Sea
		// Attaching a new option under Air puts it at depth 2, but the answer is
		// about the deepest option in the hierarchy the edge belongs to.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18", "Sea", "Trainer"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
			"Sea":         {"Air"},
		})

		depth, err := th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Trainer", "Sea"),
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 3, depth, "Air, Sea, Trainer -- the branch the edge is on")

		depth, err = th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Trainer", "F-18"),
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 4, depth)
	})

	t.Run("a chain the change shortens is measured as it will be", func(t *testing.T) {
		// Air ── Fighter Jet ── F-18, with Trainer about to be hung under F-18 in the
		// same change that lifts F-18 out of the chain and makes it a root.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18", "Trainer"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		add := []*model.PropertyOptionEdge{edge(graph, "Trainer", "F-18")}
		depth, err := th.service.DepthAfterAdding(graph.field, add, nil)
		require.NoError(t, err)
		require.Equal(t, 4, depth, "Air, Fighter Jet, F-18, Trainer")

		depth, err = th.service.DepthAfterAdding(graph.field, add, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Fighter Jet"),
		})
		require.NoError(t, err)
		require.Equal(t, 2, depth, "F-18, Trainer -- all that is left of the chain once F-18 is a root")
	})

	t.Run("nothing to add adds no depth", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		depth, err := th.service.DepthAfterAdding(graph.field, nil, nil)
		require.NoError(t, err)
		require.Zero(t, depth)
	})

	t.Run("a hierarchy with a cycle has no longest chain", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{"Fighter Jet": {"Air"}})

		// The store enforces nothing about the shape of a hierarchy -- the checks
		// that do sit above it -- so a cycle can be stored. Asked for a depth over
		// one, this reports it rather than walking it forever or picking a number.
		require.NoError(t, th.dbStore.PropertyField().MutateOptions(graph.field.GroupID, graph.field.ID, 0, nil, []*model.PropertyOptionEdge{
			edge(graph, "Air", "Fighter Jet"),
		}, nil))

		_, err := th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		}, nil)
		require.Error(t, err)
	})
}

func TestGraphResolutionThroughLinkedField(t *testing.T) {
	th := Setup(t)

	// The shape the whole feature is for: the hierarchy lives on a template, and
	// the fields users and channels carry link to it. A linked field owns neither
	// the options nor the edges, so resolving against its own ID would find every
	// option unrelated to every other and deny access with nothing to show for it.
	graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
		"Fighter Jet": {"Air"},
		"F-18":        {"Fighter Jet"},
	})

	linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:       graph.field.GroupID,
		Name:          "ProgramsLinked-" + model.NewId(),
		Type:          model.PropertyFieldTypeGraph,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &graph.field.ID,
		Attrs:         model.StringInterface{"options": graph.field.Attrs["options"]},
	})
	derived := &graphFixture{field: linked, ids: graph.ids}

	// A holder of Air is told about F-18 unchanged, since Air is above it.
	visible, err := th.service.clampToCoverage(th.Context, derived.field, derived.of("F-18"), derived.of("Air"), nil)
	require.NoError(t, err)
	require.Equal(t, []string{"F-18"}, derived.named(visible))

	// The other way round, a holder of F-18 is told only their own part of Air.
	visible, err = th.service.clampToCoverage(th.Context, derived.field, derived.of("Air"), derived.of("F-18"), nil)
	require.NoError(t, err)
	require.Equal(t, []string{"F-18"}, derived.named(visible))

	// And a holder of Fighter Jet, one level up, sees their own part instead.
	visible, err = th.service.clampToCoverage(th.Context, derived.field, derived.of("Air"), derived.of("Fighter Jet"), nil)
	require.NoError(t, err)
	require.Equal(t, []string{"Fighter Jet"}, derived.named(visible))
}
