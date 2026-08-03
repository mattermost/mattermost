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
	require.NoError(t, th.dbStore.PropertyField().CreateOptionEdges(edges))

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

func TestGraphAncestorsAndDescendants(t *testing.T) {
	th := Setup(t)
	graph := setupWorkedExample(t, th)

	t.Run("options above and below, keyed by the option asked about", func(t *testing.T) {
		above, err := th.service.AncestorsOrSelf(th.Context, graph.field, graph.of("C", "D"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"C", "B", "A"}, graph.named(above[graph.ids["C"]]))
		require.ElementsMatch(t, []string{"D", "A"}, graph.named(above[graph.ids["D"]]))

		below, err := th.service.DescendantsOrSelf(th.Context, graph.field, graph.of("A"))
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"A", "B", "C", "D"}, graph.named(below[graph.ids["A"]]))
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

		// And the predicates over it refuse rather than answering by exact
		// equality, which is what walking an unlinked option set would amount to.
		covers, err := th.service.CoversAll(th.Context, multiselect, []string{"a"}, []string{"a"})
		require.Error(t, err)
		require.False(t, covers)
	})
}

func TestGraphCoversAndWithin(t *testing.T) {
	th := Setup(t)

	t.Run("the worked example: a channel marked with C and D", func(t *testing.T) {
		graph := setupWorkedExample(t, th)
		channel := graph.of("C", "D")

		for _, tc := range []struct {
			name    string
			held    []string
			covers  bool
			coversA bool
		}{
			// A is above both, so one option accounts for the whole channel.
			{name: "the root above both", held: graph.of("A"), covers: true, coversA: true},
			// B is above C and D is itself: different options cover different
			// values, which is enough.
			{name: "one option per value", held: graph.of("B", "D"), covers: true, coversA: true},
			// D accounts for D and nothing accounts for C.
			{name: "only one of the two", held: graph.of("D"), covers: false, coversA: true},
			// C's own branch does not reach D's.
			{name: "below one, unrelated to the other", held: graph.of("C"), covers: false, coversA: true},
		} {
			t.Run(tc.name, func(t *testing.T) {
				all, err := th.service.CoversAll(th.Context, graph.field, tc.held, channel)
				require.NoError(t, err)
				require.Equal(t, tc.covers, all)

				some, err := th.service.CoversAny(th.Context, graph.field, tc.held, channel)
				require.NoError(t, err)
				require.Equal(t, tc.coversA, some)
			})
		}
	})

	t.Run("unrelated branches are an ordinary no", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Sea"}, nil)

		covers, err := th.service.CoversAny(th.Context, graph.field, graph.of("Air"), graph.of("Sea"))
		require.NoError(t, err)
		require.False(t, covers)

		within, err := th.service.WithinAny(th.Context, graph.field, graph.of("Air"), graph.of("Sea"))
		require.NoError(t, err)
		require.False(t, within)
	})

	t.Run("within: all of the holder's options, or any of them", func(t *testing.T) {
		// Air ── Fighter Jet ── F-18, with Navy a root of its own.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18", "Navy"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})
		target := graph.of("Fighter Jet")

		// F-18 is inside the target's subtree, Navy is not: holding both is
		// entirely inside nothing, which is the case the two quantifiers differ on
		// and the reason the direction exists at all.
		all, err := th.service.WithinAll(th.Context, graph.field, graph.of("F-18", "Navy"), target)
		require.NoError(t, err)
		require.False(t, all)

		some, err := th.service.WithinAny(th.Context, graph.field, graph.of("F-18", "Navy"), target)
		require.NoError(t, err)
		require.True(t, some)

		// F-18 alone passes both, and the target itself passes: being within is
		// reflexive, like covering.
		for _, held := range [][]string{graph.of("F-18"), graph.of("Fighter Jet")} {
			all, err = th.service.WithinAll(th.Context, graph.field, held, target)
			require.NoError(t, err)
			require.True(t, all)
		}

		// Air is above the target, so it is not within it -- covering would say
		// yes, which is the whole point of having both directions.
		all, err = th.service.WithinAll(th.Context, graph.field, graph.of("Air"), target)
		require.NoError(t, err)
		require.False(t, all)

		covers, err := th.service.CoversAll(th.Context, graph.field, graph.of("Air"), target)
		require.NoError(t, err)
		require.True(t, covers)
	})

	t.Run("within admits a role and everything under it, and nothing above", func(t *testing.T) {
		// Executives ── Managers ── Users: the rule that keeps leadership out of an
		// individual-contributor channel.
		graph := setupGraph(t, th, []string{"Executives", "Managers", "Users"}, map[string][]string{
			"Managers": {"Executives"},
			"Users":    {"Managers"},
		})
		target := graph.of("Managers")

		for name, admitted := range map[string]bool{"Managers": true, "Users": true, "Executives": false} {
			within, err := th.service.WithinAll(th.Context, graph.field, graph.of(name), target)
			require.NoError(t, err)
			require.Equal(t, admitted, within, name)
		}
	})

	t.Run("multiple parents and multiple roots", func(t *testing.T) {
		// F-18 hangs under a program and under a clearance level, which is how a
		// second dimension is represented.
		graph := setupGraph(t, th, []string{"Air", "Secret", "F-18"}, map[string][]string{
			"F-18": {"Air", "Secret"},
		})

		for _, root := range []string{"Air", "Secret"} {
			covers, err := th.service.CoversAll(th.Context, graph.field, graph.of(root), graph.of("F-18"))
			require.NoError(t, err)
			require.True(t, covers, root)
		}

		// Neither root is above the other, so holding one does not account for a
		// channel marked with both.
		covers, err := th.service.CoversAll(th.Context, graph.field, graph.of("Air"), graph.of("Air", "Secret"))
		require.NoError(t, err)
		require.False(t, covers)
	})

	t.Run("an empty side is a no, in both directions", func(t *testing.T) {
		graph := setupWorkedExample(t, th)

		for name, check := range map[string]func(held, targets []string) (bool, error){
			"CoversAll": func(held, targets []string) (bool, error) {
				return th.service.CoversAll(th.Context, graph.field, held, targets)
			},
			"CoversAny": func(held, targets []string) (bool, error) {
				return th.service.CoversAny(th.Context, graph.field, held, targets)
			},
			"WithinAll": func(held, targets []string) (bool, error) {
				return th.service.WithinAll(th.Context, graph.field, held, targets)
			},
			"WithinAny": func(held, targets []string) (bool, error) {
				return th.service.WithinAny(th.Context, graph.field, held, targets)
			},
		} {
			t.Run(name, func(t *testing.T) {
				held, err := check(nil, graph.of("A"))
				require.NoError(t, err)
				require.False(t, held, "holding nothing is not being cleared for everything")

				targets, err := check(graph.of("A"), nil)
				require.NoError(t, err)
				require.False(t, targets, "a target set that resolved to nothing is not open to everyone")
			})
		}
	})

	t.Run("an option that no longer exists is answered no", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{"Fighter Jet": {"Air"}})

		// The channel is marked with an option the field has not got -- a value
		// left behind by a deletion. Nothing covers it, including the option above
		// where it used to be.
		covers, err := th.service.CoversAll(th.Context, graph.field, graph.of("Air"), []string{model.NewId()})
		require.NoError(t, err)
		require.False(t, covers)

		// And a holder of a deleted option covers nothing.
		covers, err = th.service.CoversAny(th.Context, graph.field, []string{model.NewId()}, graph.of("Fighter Jet"))
		require.NoError(t, err)
		require.False(t, covers)
	})
}

func TestGraphCommonGround(t *testing.T) {
	th := Setup(t)

	t.Run("the most specific options every participant covers", func(t *testing.T) {
		graph := setupWorkedExample(t, th)

		// Bob is above C and holds D; Alice is above all four. Everything Bob
		// reaches is shared, and the two options at the top of it are B and D --
		// C is below B and so implied by it.
		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("B", "D"), graph.of("A")})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"B", "D"}, graph.named(shared))

		// Order of participants does not change the answer, though only the first
		// one's options are walked down from.
		shared, err = th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("A"), graph.of("B", "D")})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"B", "D"}, graph.named(shared))
	})

	t.Run("one participant's option lies below the other's", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		// Bob covers Fighter Jet and F-18, Alice only F-18: one label.
		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("Fighter Jet"), graph.of("F-18")})
		require.NoError(t, err)
		require.Equal(t, []string{"F-18"}, graph.named(shared))
	})

	t.Run("participants on unrelated branches share nothing", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Sea"}, nil)

		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("Air"), graph.of("Sea")})
		require.NoError(t, err)
		require.Empty(t, shared)
	})

	t.Run("a participant holding nothing leaves nothing in common", func(t *testing.T) {
		graph := setupWorkedExample(t, th)

		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("A"), nil})
		require.NoError(t, err)
		require.Empty(t, shared)

		// A participant holding an option that no longer exists is the same case:
		// they cover nothing.
		shared, err = th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("A"), {model.NewId()}})
		require.NoError(t, err)
		require.Empty(t, shared)
	})

	t.Run("one participant shares everything they reach", func(t *testing.T) {
		graph := setupWorkedExample(t, th)

		// Nobody else has to cover anything, so the participant's own options are
		// the most specific shared ones -- not their whole subtree.
		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("B", "D")})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"B", "D"}, graph.named(shared))

		// Including when there is nobody to disagree, an option the field does not
		// have is not something to report as shared.
		shared, err = th.service.CommonGround(th.Context, graph.field, [][]string{{model.NewId()}})
		require.NoError(t, err)
		require.Empty(t, shared)
	})

	t.Run("the same option held twice is reported once", func(t *testing.T) {
		graph := setupWorkedExample(t, th)

		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("B", "B"), graph.of("A")})
		require.NoError(t, err)
		require.Equal(t, []string{"B"}, graph.named(shared))
	})

	t.Run("branches that stop at related options report only the top one", func(t *testing.T) {
		// Air ─┬─ Fighter Jet ── F-18
		//      └─ F-18
		// Descending from Air reaches F-18 both directly and through Fighter Jet,
		// so a walk that stopped at each without comparing them would report an
		// option that another reported option is above.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Air", "Fighter Jet"},
		})

		shared, err := th.service.CommonGround(th.Context, graph.field, [][]string{graph.of("Air"), graph.of("Fighter Jet", "F-18")})
		require.NoError(t, err)
		require.Equal(t, []string{"Fighter Jet"}, graph.named(shared))
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
		})
		require.NoError(t, err)
		require.True(t, cycle)

		// A second parent for the lowest option does not.
		cycle, err = th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Air"),
		})
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
			cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{single})
			require.NoError(t, err)
			require.False(t, cycle)
		}

		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Sea", "Fighter Jet"),
			edge(graph, "Air", "Frigate"),
		})
		require.NoError(t, err)
		require.True(t, cycle, "the two edges close a circle through both existing chains")
	})

	t.Run("an option under itself", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		cycle, err := th.service.WouldCreateCycle(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Air", "Air"),
		})
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
		})
		require.NoError(t, err)
		require.False(t, cycle)
	})

	t.Run("nothing to add cannot create anything", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		cycle, err := th.service.WouldCreateCycle(graph.field, nil)
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
		})
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
		})
		require.NoError(t, err)
		require.Equal(t, 3, depth, "Air, Bomber, B-2")

		// Hanging the bottom of one chain under the bottom of the other counts
		// both chains.
		depth, err = th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Bomber", "Fighter Jet"),
		})
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
		})
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
		})
		require.NoError(t, err)
		require.Equal(t, 3, depth, "Air, Sea, Trainer -- the branch the edge is on")

		depth, err = th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Trainer", "F-18"),
		})
		require.NoError(t, err)
		require.Equal(t, 4, depth)
	})

	t.Run("nothing to add adds no depth", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air"}, nil)

		depth, err := th.service.DepthAfterAdding(graph.field, nil)
		require.NoError(t, err)
		require.Zero(t, depth)
	})

	t.Run("a hierarchy with a cycle has no longest chain", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{"Fighter Jet": {"Air"}})

		// Nothing refuses a cycle at write time yet, so one can be stored. Asked
		// for a depth over it, this reports the cycle rather than walking it
		// forever or picking a number.
		require.NoError(t, th.dbStore.PropertyField().CreateOptionEdges([]*model.PropertyOptionEdge{
			edge(graph, "Air", "Fighter Jet"),
		}))

		_, err := th.service.DepthAfterAdding(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		})
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

	covers, err := th.service.CoversAll(th.Context, derived.field, derived.of("Air"), derived.of("F-18"))
	require.NoError(t, err)
	require.True(t, covers)

	within, err := th.service.WithinAll(th.Context, derived.field, derived.of("F-18"), derived.of("Air"))
	require.NoError(t, err)
	require.True(t, within)

	shared, err := th.service.CommonGround(th.Context, derived.field, [][]string{derived.of("Air"), derived.of("Fighter Jet")})
	require.NoError(t, err)
	require.Equal(t, []string{"Fighter Jet"}, derived.named(shared))
}
