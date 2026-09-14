// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

// TestPropertyOptionHierarchyWalkBudget asserts the row budget on
// walkOptionHierarchy directly, on a hierarchy far smaller than the real bound:
// the exported store methods pass model.PropertyGraphMaxWalkRows, which no test
// can afford to exceed on a live hierarchy.
func TestPropertyOptionHierarchyWalkBudget(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		groupID := model.NewId()

		// newGraphField creates a graph field owning one option per name, under the
		// identifiers the caller supplies.
		newGraphField := func(t *testing.T, optionIDsByName map[string]string) *model.PropertyField {
			t.Helper()
			options := make([]any, 0, len(optionIDsByName))
			for name, id := range optionIDsByName {
				options = append(options, map[string]any{"id": id, "name": name})
			}
			field, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:    groupID,
				Name:       "WalkBudget-" + model.NewId(),
				Type:       model.PropertyFieldTypeGraph,
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs:      model.StringInterface{"options": options},
			})
			require.NoError(t, err)
			return field
		}

		link := func(t *testing.T, field *model.PropertyField, ids map[string]string, pairs ...[2]string) {
			t.Helper()
			edges := make([]*model.PropertyOptionEdge, 0, len(pairs))
			for _, pair := range pairs {
				edges = append(edges, &model.PropertyOptionEdge{
					FieldID:        field.ID,
					ChildOptionID:  ids[pair[0]],
					ParentOptionID: ids[pair[1]],
				})
			}
			require.NoError(t, ss.PropertyField().MutateOptions(groupID, field.ID, field.UpdateAt, nil, edges, nil))
		}

		// A ─┬─ B ── C
		//    └─ D
		// Walking up from C and D produces five (seed, option) rows: C,B,A and D,A.
		ids := map[string]string{"A": model.NewId(), "B": model.NewId(), "C": model.NewId(), "D": model.NewId()}
		field := newGraphField(t, ids)
		link(t, field, ids, [2]string{"B", "A"}, [2]string{"C", "B"}, [2]string{"D", "A"})

		fieldStore := ss.PropertyField().(*SqlPropertyFieldStore)

		t.Run("a walk within budget returns every row", func(t *testing.T) {
			above, err := fieldStore.walkOptionHierarchy(field, []string{ids["C"], ids["D"]}, towardsParents, 5)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"C", "B", "A"}, namedBy(ids, above[ids["C"]]))
			require.ElementsMatch(t, []string{"D", "A"}, namedBy(ids, above[ids["D"]]))
		})

		t.Run("a walk over budget is refused, not truncated", func(t *testing.T) {
			above, err := fieldStore.walkOptionHierarchy(field, []string{ids["C"], ids["D"]}, towardsParents, 4)
			require.Error(t, err)
			require.Contains(t, err.Error(), field.ID)
			require.Contains(t, err.Error(), "4")
			require.Nil(t, above)
		})

		t.Run("the bound applies to the downward walk too", func(t *testing.T) {
			// A alone reaches itself, B, C and D: four rows.
			below, err := fieldStore.walkOptionHierarchy(field, []string{ids["A"]}, towardsChildren, 4)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"A", "B", "C", "D"}, namedBy(ids, below[ids["A"]]))

			below, err = fieldStore.walkOptionHierarchy(field, []string{ids["A"]}, towardsChildren, 3)
			require.Error(t, err)
			require.Nil(t, below)
		})

		t.Run("the real bound does not refuse an ordinary walk", func(t *testing.T) {
			above, err := ss.PropertyField().GetOptionAncestorsOrSelf(field, []string{ids["C"], ids["D"]})
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"C", "B", "A"}, namedBy(ids, above[ids["C"]]))
			require.ElementsMatch(t, []string{"D", "A"}, namedBy(ids, above[ids["D"]]))
		})
	})
}

// namedBy turns a walk's result back into option names, so a failure reads as
// the hierarchy the test wrote rather than as a list of identifiers.
func namedBy(ids map[string]string, reached []string) []string {
	byID := make(map[string]string, len(ids))
	for name, id := range ids {
		byID[id] = name
	}
	out := make([]string, 0, len(reached))
	for _, id := range reached {
		out = append(out, byID[id])
	}
	return out
}
