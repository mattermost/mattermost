// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestBuildBoardKanbanView(t *testing.T) {
	t.Run("rejects status field with no options attribute", func(t *testing.T) {
		statusField := &model.PropertyField{
			ID:    model.NewId(),
			Attrs: map[string]any{},
		}

		view, err := buildBoardKanbanView(model.NewId(), statusField)
		require.Nil(t, view)
		require.NotNil(t, err)
		require.Contains(t, err.DetailedError, "status field has no options")
	})

	t.Run("rejects status field with empty options", func(t *testing.T) {
		statusField := &model.PropertyField{
			ID:    model.NewId(),
			Attrs: map[string]any{"options": []any{}},
		}

		view, err := buildBoardKanbanView(model.NewId(), statusField)
		require.Nil(t, view)
		require.NotNil(t, err)
	})

	t.Run("builds a column per valid option", func(t *testing.T) {
		creatorID := model.NewId()
		statusField := &model.PropertyField{
			ID: model.NewId(),
			Attrs: map[string]any{
				"options": []any{
					map[string]any{"id": "opt-todo", "name": "Todo"},
					map[string]any{"id": "opt-doing", "name": "Doing"},
					map[string]any{"id": "opt-done", "name": "Done"},
				},
			},
		}

		view, err := buildBoardKanbanView(creatorID, statusField)
		require.Nil(t, err)
		require.NotNil(t, view)
		assert.Equal(t, model.ViewTypeKanban, view.Type)
		assert.Equal(t, creatorID, view.CreatorId)
		assert.Equal(t, "Board", view.Title)

		kanban, kErr := model.KanbanPropsFromProps(view.Props)
		require.NoError(t, kErr)
		assert.Equal(t, statusField.ID, kanban.GroupBy.FieldID)
		require.Len(t, kanban.GroupBy.Columns, 3)
		assert.Equal(t, "Todo", kanban.GroupBy.Columns[0].Name)
		assert.Equal(t, []string{"opt-todo"}, kanban.GroupBy.Columns[0].OptionIDs)
		assert.Equal(t, "Doing", kanban.GroupBy.Columns[1].Name)
		assert.Equal(t, "Done", kanban.GroupBy.Columns[2].Name)
		for _, col := range kanban.GroupBy.Columns {
			assert.NotEmpty(t, col.ID, "column should have a generated ID")
		}
	})

	t.Run("skips options that are not maps or have missing fields", func(t *testing.T) {
		statusField := &model.PropertyField{
			ID: model.NewId(),
			Attrs: map[string]any{
				"options": []any{
					"not-a-map", // skipped
					map[string]any{"id": "", "name": "blank-id"}, // skipped (empty id)
					map[string]any{"id": "opt-x", "name": ""},    // skipped (empty name)
					map[string]any{"id": "opt-todo", "name": "Todo"},
				},
			},
		}

		view, err := buildBoardKanbanView(model.NewId(), statusField)
		require.Nil(t, err)
		require.NotNil(t, view)

		kanban, kErr := model.KanbanPropsFromProps(view.Props)
		require.NoError(t, kErr)
		require.Len(t, kanban.GroupBy.Columns, 1)
		assert.Equal(t, "Todo", kanban.GroupBy.Columns[0].Name)
	})
}
