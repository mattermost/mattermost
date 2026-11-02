// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

// TestPropertyFieldOptionsPage exercises getFieldOptionsPage's candidate window
// directly, on bounds far smaller than
// model.PropertyFieldOptionCandidatesMaxPerRequest: the exported GetFieldOptions
// passes that bound, which no test can afford to fill on a live hierarchy.
func TestPropertyFieldOptionsPage(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		groupID := model.NewId()
		fieldStore := ss.PropertyField().(*SqlPropertyFieldStore)

		newGraphField := func(t *testing.T, optionIDsByName map[string]string) *model.PropertyField {
			t.Helper()
			options := make([]any, 0, len(optionIDsByName))
			for name, id := range optionIDsByName {
				options = append(options, map[string]any{"id": id, "name": name})
			}
			field, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:    groupID,
				Name:       "OptionsPage-" + model.NewId(),
				Type:       model.PropertyFieldTypeGraph,
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs:      model.StringInterface{"options": options},
			})
			require.NoError(t, err)
			return field
		}

		named := func(ids map[string]string, options []*model.PropertyFieldOption) []string {
			byID := make(map[string]string, len(ids))
			for name, id := range ids {
				byID[id] = name
			}
			out := make([]string, 0, len(options))
			for _, option := range options {
				out = append(out, byID[option.ID])
			}
			return out
		}

		// X, Y, Z are unrelated to the A-B-C hierarchy and created first, so they
		// sort ahead of it by (CreateAt, ID): the covered options sit behind a run
		// of rows the caller may not see. A, B, and C are each upserted in their
		// own call, and the sleeps
		// between every step are what makes all of this ordering deterministic
		// rather than a race on millisecond timestamps.
		ids := map[string]string{"X": model.NewId(), "Y": model.NewId(), "Z": model.NewId()}
		field := newGraphField(t, ids)
		time.Sleep(2 * time.Millisecond)

		ids["A"] = model.NewId()
		ids["B"] = model.NewId()
		ids["C"] = model.NewId()
		// expectedUpdateAt 0 throughout this test: nothing here races with another
		// writer, so there is nothing for the compare-and-swap to protect.
		for _, name := range []string{"A", "B", "C"} {
			require.NoError(t, fieldStore.MutateOptions(groupID, field.ID, 0,
				[]*model.PropertyFieldOption{{ID: ids[name], Name: name}}, nil, nil))
			time.Sleep(2 * time.Millisecond)
		}
		require.NoError(t, fieldStore.MutateOptions(groupID, field.ID, 0, nil, []*model.PropertyOptionEdge{
			{FieldID: field.ID, ChildOptionID: ids["B"], ParentOptionID: ids["A"]},
			{FieldID: field.ID, ChildOptionID: ids["C"], ParentOptionID: ids["B"]},
		}, nil))

		t.Run("nil filter pages everything, unbothered by the hierarchy", func(t *testing.T) {
			page, err := fieldStore.getFieldOptionsPage(field, 0, "", 5, nil, 2000)
			require.NoError(t, err)
			require.True(t, page.HasMore, "5 of 6 options filled the page")
			require.Len(t, page.Options, 5)

			page, err = fieldStore.getFieldOptionsPage(field, page.NextCursorCreateAt, page.NextCursorID, 5, nil, 2000)
			require.NoError(t, err)
			require.False(t, page.HasMore, "a page past the end is short")
			require.Len(t, page.Options, 1)
		})

		t.Run("a filtered page comes back full while options remain, then ends", func(t *testing.T) {
			filter := &model.PropertyFieldOptionPageFilter{CoveredBy: []string{ids["B"]}}

			page, err := fieldStore.getFieldOptionsPage(field, 0, "", 1, filter, 2000)
			require.NoError(t, err)
			require.True(t, page.HasMore)
			require.Equal(t, []string{"B"}, named(ids, page.Options), "the page comes back full with B, not empty or short")

			page, err = fieldStore.getFieldOptionsPage(field, page.NextCursorCreateAt, page.NextCursorID, 1, filter, 2000)
			require.NoError(t, err)
			require.Equal(t, []string{"C"}, named(ids, page.Options))

			page, err = fieldStore.getFieldOptionsPage(field, page.NextCursorCreateAt, page.NextCursorID, 1, filter, 2000)
			require.NoError(t, err)
			require.False(t, page.HasMore)
			require.Empty(t, page.Options, "nothing the caller does not cover is ever returned")
		})

		t.Run("a short candidate window still advances the cursor past what it dropped", func(t *testing.T) {
			// maxCandidates 2 puts X and Y alone in the first window: neither is
			// covered, so the first page comes back empty even though B and C, both
			// covered, are still ahead of the cursor.
			filter := &model.PropertyFieldOptionPageFilter{CoveredBy: []string{ids["B"]}}

			page, err := fieldStore.getFieldOptionsPage(field, 0, "", 1, filter, 2)
			require.NoError(t, err)
			require.Empty(t, page.Options, "a short page no longer means the end of the listing")
			require.True(t, page.HasMore)

			var reached []string
			for page.HasMore {
				page, err = fieldStore.getFieldOptionsPage(field, page.NextCursorCreateAt, page.NextCursorID, 1, filter, 2)
				require.NoError(t, err)
				reached = append(reached, named(ids, page.Options)...)
			}
			require.Equal(t, []string{"B", "C"}, reached, "paging from the cursor reaches everything covered")
		})

		t.Run("ShowNothing and an empty CoveredBy both fail closed", func(t *testing.T) {
			page, err := fieldStore.getFieldOptionsPage(field, 0, "", 5, &model.PropertyFieldOptionPageFilter{ShowNothing: true}, 2000)
			require.NoError(t, err)
			require.NotNil(t, page.Options)
			require.Empty(t, page.Options)
			require.False(t, page.HasMore)

			page, err = fieldStore.getFieldOptionsPage(field, 0, "", 5, &model.PropertyFieldOptionPageFilter{}, 2000)
			require.NoError(t, err)
			require.NotNil(t, page.Options)
			require.Empty(t, page.Options)
			require.False(t, page.HasMore)
		})

		t.Run("the exported GetFieldOptions wires the real candidate bound", func(t *testing.T) {
			// perPage larger than the field's whole option count, so the page comes
			// back short and HasMore is unambiguous.
			page, err := ss.PropertyField().GetFieldOptions(field, 0, "", 7, nil)
			require.NoError(t, err)
			require.False(t, page.HasMore)
			require.ElementsMatch(t, []string{"X", "Y", "Z", "A", "B", "C"}, named(ids, page.Options))
		})
	})
}

func TestPropertyFieldOptionsChunkedWrites(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		groupID := model.NewId()
		fieldStore := ss.PropertyField().(*SqlPropertyFieldStore)
		n := maxPropertyOptionRowsPerQuery + 1
		ids := make([]string, n)
		options := make([]any, n)
		for i := range n {
			ids[i] = model.NewId()
			options[i] = map[string]any{"id": ids[i], "name": fmt.Sprintf("opt-%d", i)}
		}

		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "ChunkedWrites-" + model.NewId(),
			Type:       model.PropertyFieldTypeGraph,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{"options": options},
		})
		require.NoError(t, err)

		var count int
		err = fieldStore.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", field.ID)
		require.NoError(t, err)
		require.Equal(t, n, count)

		var minSort, maxSort int
		err = fieldStore.GetMaster().Get(&minSort,
			"SELECT MIN(SortOrder) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", field.ID)
		require.NoError(t, err)
		err = fieldStore.GetMaster().Get(&maxSort,
			"SELECT MAX(SortOrder) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", field.ID)
		require.NoError(t, err)
		require.Equal(t, 1, minSort)
		require.Equal(t, n, maxSort)

		var orderedIDs []string
		err = fieldStore.GetMaster().Select(&orderedIDs,
			"SELECT ID FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0 ORDER BY SortOrder", field.ID)
		require.NoError(t, err)
		require.Equal(t, ids, orderedIDs)

		update := &model.PropertyField{
			ID:         field.ID,
			GroupID:    field.GroupID,
			Name:       field.Name,
			Type:       field.Type,
			ObjectType: field.ObjectType,
			TargetType: field.TargetType,
			CreateAt:   field.CreateAt,
			UpdateAt:   field.UpdateAt,
			Attrs:      model.StringInterface{"options": []any{}},
		}
		_, err = ss.PropertyField().Update("", []*model.PropertyField{update}, nil)
		require.NoError(t, err)

		err = fieldStore.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1 AND DeleteAt = 0", field.ID)
		require.NoError(t, err)
		require.Equal(t, 0, count)
	})
}
