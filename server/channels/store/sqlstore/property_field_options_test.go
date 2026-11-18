// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"slices"
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

// TestPropertyFieldOptionsPageRank covers the rank branch of the filtered page:
// a candidate passes when its rank is at or below the highest rank held.
func TestPropertyFieldOptionsPageRank(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		groupID := model.NewId()
		fieldStore := ss.PropertyField().(*SqlPropertyFieldStore)

		// All options of one Create share a CreateAt, so the page order is the ID
		// order; sorted IDs make Internal, Secret, Top Secret, Unranked the
		// listing order.
		raw := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		slices.Sort(raw)
		internal, secret, topSecret, unranked := raw[0], raw[1], raw[2], raw[3]
		names := map[string]string{internal: "Internal", secret: "Secret", topSecret: "Top Secret", unranked: "Unranked"}

		template, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "RankPage-" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"id": internal, "name": "Internal", "rank": 1},
				map[string]any{"id": secret, "name": "Secret", "rank": 2},
				map[string]any{"id": topSecret, "name": "Top Secret", "rank": 3},
				map[string]any{"id": unranked, "name": "Unranked"},
			}},
		})
		require.NoError(t, err)

		// walk pages the whole listing and returns the names it reached, in order.
		walk := func(t *testing.T, field *model.PropertyField, coveredBy []string, perPage, maxCandidates int) []string {
			t.Helper()
			filter := &model.PropertyFieldOptionPageFilter{CoveredBy: coveredBy}
			reached := []string{}
			var createAt int64
			var cursor string
			for {
				page, err := fieldStore.getFieldOptionsPage(field, createAt, cursor, perPage, filter, maxCandidates)
				require.NoError(t, err)
				for _, option := range page.Options {
					reached = append(reached, names[option.ID])
				}
				if !page.HasMore {
					return reached
				}
				createAt, cursor = page.NextCursorCreateAt, page.NextCursorID
			}
		}

		t.Run("pages every option at or below the highest held rank", func(t *testing.T) {
			require.Equal(t, []string{"Internal"}, walk(t, template, []string{internal}, 1, 2000))
			require.Equal(t, []string{"Internal", "Secret"}, walk(t, template, []string{secret}, 1, 2000))
			require.Equal(t, []string{"Internal", "Secret", "Top Secret"}, walk(t, template, []string{topSecret}, 1, 2000))
		})

		t.Run("the highest of several held options counts", func(t *testing.T) {
			require.Equal(t, []string{"Internal", "Secret"}, walk(t, template, []string{internal, secret}, 5, 2000))
		})

		t.Run("an unranked or unknown held option covers nothing", func(t *testing.T) {
			require.Empty(t, walk(t, template, []string{unranked}, 5, 2000))
			require.Empty(t, walk(t, template, []string{model.NewId()}, 5, 2000))
		})

		t.Run("a small candidate window still reaches every passing option", func(t *testing.T) {
			require.Equal(t, []string{"Internal", "Secret", "Top Secret"}, walk(t, template, []string{topSecret}, 1, 1))
		})

		t.Run("a linked field pages its template's options by the same rule", func(t *testing.T) {
			linked, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:       groupID,
				Name:          "RankPageLinked-" + model.NewId(),
				Type:          model.PropertyFieldTypeRank,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
			})
			require.NoError(t, err)
			require.Equal(t, []string{"Internal", "Secret"}, walk(t, linked, []string{secret}, 1, 2000))
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

func TestPropertyFieldOptionRanks(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		groupID := model.NewId()
		fieldStore := ss.PropertyField().(*SqlPropertyFieldStore)

		ranked, unranked, deleted := model.NewId(), model.NewId(), model.NewId()
		zero := model.NewId()
		field, err := ss.PropertyField().Create(&model.PropertyField{
			GroupID:    groupID,
			Name:       "OptionRanks-" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{"options": []any{
				map[string]any{"id": ranked, "name": "Ranked", "rank": 3},
				map[string]any{"id": zero, "name": "Zero", "rank": 0},
				map[string]any{"id": unranked, "name": "Unranked"},
				map[string]any{"id": deleted, "name": "Deleted", "rank": 9},
			}},
		})
		require.NoError(t, err)
		require.NoError(t, fieldStore.DeleteOptions(groupID, field.ID, 0, []string{deleted}))

		t.Run("ranked options come back with their ranks, rank 0 included", func(t *testing.T) {
			ranks, err := fieldStore.GetOptionRanks(field, []string{ranked, zero, ranked})
			require.NoError(t, err)
			require.Equal(t, map[string]int64{ranked: 3, zero: 0}, ranks)
		})

		t.Run("unranked, deleted and unknown options are absent", func(t *testing.T) {
			ranks, err := fieldStore.GetOptionRanks(field, []string{unranked, deleted, model.NewId()})
			require.NoError(t, err)
			require.Empty(t, ranks)
		})

		t.Run("an option of another field is absent", func(t *testing.T) {
			other, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:    groupID,
				Name:       "OptionRanksOther-" + model.NewId(),
				Type:       model.PropertyFieldTypeRank,
				ObjectType: model.PropertyFieldObjectTypeTemplate,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
			})
			require.NoError(t, err)
			ranks, err := fieldStore.GetOptionRanks(other, []string{ranked})
			require.NoError(t, err)
			require.Empty(t, ranks)
		})

		t.Run("a linked field gets its template's ranks", func(t *testing.T) {
			linked, err := ss.PropertyField().Create(&model.PropertyField{
				GroupID:       groupID,
				Name:          "OptionRanksLinked-" + model.NewId(),
				Type:          model.PropertyFieldTypeRank,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &field.ID,
			})
			require.NoError(t, err)
			ranks, err := fieldStore.GetOptionRanks(linked, []string{ranked})
			require.NoError(t, err)
			require.Equal(t, map[string]int64{ranked: 3}, ranks)
		})

		t.Run("empty input and a nil field give an empty map", func(t *testing.T) {
			ranks, err := fieldStore.GetOptionRanks(field, nil)
			require.NoError(t, err)
			require.NotNil(t, ranks)
			require.Empty(t, ranks)

			ranks, err = fieldStore.GetOptionRanks(nil, []string{ranked})
			require.NoError(t, err)
			require.Empty(t, ranks)
		})
	})
}
