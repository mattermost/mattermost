// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// chainNames returns names for a chain of the given length, A1 at the top.
func chainNames(length int) []string {
	names := make([]string, 0, length)
	for i := 1; i <= length; i++ {
		names = append(names, fmt.Sprintf("A%d", i))
	}
	return names
}

// chainParents links every name in a chain under the one before it.
func chainParents(names []string) map[string][]string {
	parents := make(map[string][]string, len(names))
	for i := 1; i < len(names); i++ {
		parents[names[i]] = []string{names[i-1]}
	}
	return parents
}

func TestGraphValidateOptionEdges(t *testing.T) {
	th := Setup(t)

	edge := func(graph *graphFixture, child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{
			FieldID:        graph.field.ID,
			ChildOptionID:  graph.ids[child],
			ParentOptionID: graph.ids[parent],
		}
	}

	t.Run("multiple parents and multiple roots are ordinary", func(t *testing.T) {
		// Two roots, and an option under both of them: the overlay shape the type
		// exists for, where one dimension is expressed as extra parents.
		graph := setupGraph(t, th, []string{"Air", "Secret", "F-18", "F-18C"}, nil)

		require.NoError(t, th.service.ValidateOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Air"),
			edge(graph, "F-18", "Secret"),
			edge(graph, "F-18C", "F-18"),
		}, nil))
	})

	t.Run("a cycle is refused", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		err := th.service.ValidateOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Air", "F-18"),
		}, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)

		// Removing the link the new one reverses makes the same change a re-parent.
		require.NoError(t, th.service.ValidateOptionEdges(graph.field,
			[]*model.PropertyOptionEdge{edge(graph, "Air", "F-18")},
			[]*model.PropertyOptionEdge{edge(graph, "Fighter Jet", "Air"), edge(graph, "F-18", "Fighter Jet")},
		))
	})

	t.Run("a chain may be as long as the limit and no longer", func(t *testing.T) {
		// A chain one short of the limit, plus two options waiting to be attached to
		// the bottom of it.
		names := append(chainNames(model.PropertyGraphMaxDepth-1), "Last", "PastLast")
		graph := setupGraph(t, th, names, chainParents(chainNames(model.PropertyGraphMaxDepth-1)))
		deepest := fmt.Sprintf("A%d", model.PropertyGraphMaxDepth-1)

		reachesLimit := []*model.PropertyOptionEdge{edge(graph, "Last", deepest)}
		require.NoError(t, th.service.ValidateOptionEdges(graph.field, reachesLimit, nil))

		err := th.service.ValidateOptionEdges(graph.field, append(reachesLimit,
			edge(graph, "PastLast", "Last"),
		), nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
		require.Contains(t, err.Error(), fmt.Sprintf("%d options on one chain", model.PropertyGraphMaxDepth+1))
	})

	t.Run("an option may have as many parents as the limit and no more", func(t *testing.T) {
		names := append(chainNames(model.PropertyGraphMaxParentsPerOption+1), "Child")
		graph := setupGraph(t, th, names, nil)

		atLimit := make([]*model.PropertyOptionEdge, 0, model.PropertyGraphMaxParentsPerOption)
		for _, parent := range chainNames(model.PropertyGraphMaxParentsPerOption) {
			atLimit = append(atLimit, edge(graph, "Child", parent))
		}
		require.NoError(t, th.service.ValidateOptionEdges(graph.field, atLimit, nil))
		require.NoError(t, th.service.ApplyOptionEdges(graph.field, atLimit, nil))

		// One more, counted against the parents the option already has rather than
		// against the size of the change.
		oneMore := []*model.PropertyOptionEdge{
			edge(graph, "Child", fmt.Sprintf("A%d", model.PropertyGraphMaxParentsPerOption+1)),
		}
		err := th.service.ValidateOptionEdges(graph.field, oneMore, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
		require.Contains(t, err.Error(), fmt.Sprintf("would have %d options directly above it", model.PropertyGraphMaxParentsPerOption+1))

		// Unless the change gives up one of them at the same time.
		require.NoError(t, th.service.ValidateOptionEdges(graph.field, oneMore, atLimit[:1]))
	})

	t.Run("a change that names another field's edges is refused", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, nil)
		other := setupGraph(t, th, []string{"Sea"}, nil)

		err := th.service.ValidateOptionEdges(graph.field, []*model.PropertyOptionEdge{
			{FieldID: other.field.ID, ChildOptionID: other.ids["Sea"], ParentOptionID: other.ids["Sea"]},
		}, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)

		err = th.service.ValidateOptionEdges(graph.field, nil, []*model.PropertyOptionEdge{
			{FieldID: other.field.ID, ChildOptionID: other.ids["Sea"], ParentOptionID: other.ids["Sea"]},
		})
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
	})

	t.Run("a field whose options form no hierarchy is refused", func(t *testing.T) {
		multiselect := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Flat-" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})

		err := th.service.ValidateOptionEdges(multiselect, []*model.PropertyOptionEdge{
			{FieldID: multiselect.ID, ChildOptionID: model.NewId(), ParentOptionID: model.NewId()},
		}, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
	})

	t.Run("removing links breaks no limit", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, map[string][]string{"Fighter Jet": {"Air"}})

		require.NoError(t, th.service.ValidateOptionEdges(graph.field, nil, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		}))
	})
}

func TestGraphOptionEdgeChange(t *testing.T) {
	edge := func(child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{FieldID: "field", ChildOptionID: child, ParentOptionID: parent}
	}

	stored := []*model.PropertyOptionEdge{edge("c", "a"), edge("c", "b")}

	for name, tc := range map[string]struct {
		add    []*model.PropertyOptionEdge
		remove []*model.PropertyOptionEdge
		delta  int
	}{
		"a new link is one more":                    {add: []*model.PropertyOptionEdge{edge("c", "d")}, delta: 1},
		"a link that is already there is no more":   {add: []*model.PropertyOptionEdge{edge("c", "a")}, delta: 0},
		"the same link twice is still one":          {add: []*model.PropertyOptionEdge{edge("c", "d"), edge("c", "d")}, delta: 1},
		"a link that goes is one fewer":             {remove: []*model.PropertyOptionEdge{edge("c", "a")}, delta: -1},
		"a link that was not there does not go":     {remove: []*model.PropertyOptionEdge{edge("c", "z")}, delta: 0},
		"a link removed and added ends up present":  {add: []*model.PropertyOptionEdge{edge("c", "a")}, remove: []*model.PropertyOptionEdge{edge("c", "a")}, delta: 0},
		"a link for one option and against another": {add: []*model.PropertyOptionEdge{edge("e", "a")}, remove: []*model.PropertyOptionEdge{edge("c", "b")}, delta: 0},
	} {
		t.Run(name, func(t *testing.T) {
			_, delta := optionEdgeChange(stored, tc.add, tc.remove)
			require.Equal(t, tc.delta, delta)
		})
	}

	// The edge limit is a million links, which is too many to store in a test to
	// reject the one past it. What can be wrong is this arithmetic, so it is checked
	// at the real limit: a field holding one fewer link than the limit accepts a
	// change that brings it exactly to it, and refuses the one after that.
	t.Run("the edge limit is a comparison against this total", func(t *testing.T) {
		_, delta := optionEdgeChange(stored, []*model.PropertyOptionEdge{edge("c", "d")}, nil)
		require.Equal(t, model.PropertyGraphMaxEdges, model.PropertyGraphMaxEdges-1+delta)

		_, delta = optionEdgeChange(stored, []*model.PropertyOptionEdge{edge("c", "d"), edge("e", "d")}, nil)
		require.Greater(t, model.PropertyGraphMaxEdges-1+delta, model.PropertyGraphMaxEdges)
	})
}

func TestGraphApplyOptionEdges(t *testing.T) {
	th := Setup(t)

	edge := func(graph *graphFixture, child, parent string) *model.PropertyOptionEdge {
		return &model.PropertyOptionEdge{
			FieldID:        graph.field.ID,
			ChildOptionID:  graph.ids[child],
			ParentOptionID: graph.ids[parent],
		}
	}

	storedEdges := func(t *testing.T, graph *graphFixture) [][2]string {
		t.Helper()
		edges, err := th.dbStore.PropertyField().GetOptionEdges(graph.field.ID)
		require.NoError(t, err)
		pairs := make([][2]string, 0, len(edges))
		for _, e := range edges {
			pairs = append(pairs, [2]string{e.ChildOptionID, e.ParentOptionID})
		}
		return pairs
	}

	t.Run("a valid change is written", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, nil)

		require.NoError(t, th.service.ApplyOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		}, nil))
		require.Equal(t, [][2]string{{graph.ids["Fighter Jet"], graph.ids["Air"]}}, storedEdges(t, graph))
	})

	t.Run("a rejected change writes nothing", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "F-18"}, map[string][]string{
			"Fighter Jet": {"Air"},
			"F-18":        {"Fighter Jet"},
		})

		// One link that is fine and one that closes a circle. The limits are
		// properties of the whole change, so neither half of it lands.
		err := th.service.ApplyOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "F-18", "Air"),
			edge(graph, "Air", "F-18"),
		}, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
		require.ElementsMatch(t, [][2]string{
			{graph.ids["Fighter Jet"], graph.ids["Air"]},
			{graph.ids["F-18"], graph.ids["Fighter Jet"]},
		}, storedEdges(t, graph))
	})

	t.Run("a change decided against a field that has moved is refused", func(t *testing.T) {
		// Everything checked was checked against the hierarchy the caller's field was
		// read from, so a change somebody else committed since that read makes this a
		// conflict -- even here, where the two changes have nothing to do with each
		// other. It has to, because the case that makes the check necessary, two
		// changes that are each acyclic and jointly put an option below itself, looks
		// no different from this one at the point of writing.
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet", "Trainer"}, nil)

		require.NoError(t, th.service.ApplyOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		}, nil))

		// The change above moved the field's row; the field the test holds still
		// carries the UpdateAt it was read with, exactly as a caller reusing a read
		// across two changes would.
		err := th.service.ApplyOptionEdges(graph.field, []*model.PropertyOptionEdge{
			edge(graph, "Trainer", "Air"),
		}, nil)
		require.Error(t, err)
		var conflictErr *store.ErrConflict
		require.ErrorAs(t, err, &conflictErr)

		require.Equal(t, [][2]string{{graph.ids["Fighter Jet"], graph.ids["Air"]}}, storedEdges(t, graph))
	})

	t.Run("a field that was never read cannot be changed", func(t *testing.T) {
		graph := setupGraph(t, th, []string{"Air", "Fighter Jet"}, nil)

		// A field with no UpdateAt has nothing for the write to hold against a
		// concurrent writer, and the store reads a zero as "assert nothing".
		unread := *graph.field
		unread.UpdateAt = 0
		err := th.service.ApplyOptionEdges(&unread, []*model.PropertyOptionEdge{
			edge(graph, "Fighter Jet", "Air"),
		}, nil)
		require.ErrorIs(t, err, ErrInvalidFieldAttrs)
		require.Empty(t, storedEdges(t, graph))
	})
}
