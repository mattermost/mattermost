// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

		_, err := th.service.CreateFieldOptions(&stale, newOption("Sea"))
		require.NoError(t, err)

		// Same stale copy again. The service re-reads the field it is about to swap
		// on, so this is not a lost race; before it did, this answered 409.
		_, err = th.service.CreateFieldOptions(&stale, newOption("Land"))
		require.NoError(t, err)

		options, err := th.service.GetFieldOptions(graph.field, 0, "", 100)
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
		_, err := th.service.CreateFieldOptions(&stale, newOption("Sea"))
		require.Error(t, err)
		require.ErrorContains(t, err, "has been deleted")

		_, err = th.service.DeleteFieldOptions(&stale, graph.of("Air"))
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
		_, err := th.service.CreateFieldOptions(rank, newOption("Top Secret"))
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")

		options, err := th.service.GetFieldOptions(rank, 0, "", 100)
		require.NoError(t, err)
		require.Len(t, options, 1, "reading a rank field's options is still allowed")

		// A caller that forgot a page size is told, rather than being handed an
		// empty page it would read as a field with no options.
		_, err = th.service.GetFieldOptions(rank, 0, "", 0)
		require.Error(t, err)
		require.ErrorContains(t, err, "positive page size")

		_, _, err = th.service.UpdateFieldOptions(rank, []*model.PropertyFieldOption{
			{ID: options[0].ID, Name: "Renamed"},
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")

		_, err = th.service.DeleteFieldOptions(rank, []string{options[0].ID})
		require.Error(t, err)
		require.ErrorContains(t, err, "rank field")
	})
}
