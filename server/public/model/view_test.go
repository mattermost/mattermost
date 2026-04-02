// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validKanbanProps() StringInterface {
	kanban := &KanbanProps{
		GroupBy: KanbanGroupBy{
			FieldID: NewId(),
			Columns: []KanbanColumn{
				{ID: NewId(), Name: "Todo", OptionIDs: []string{NewId()}},
				{ID: NewId(), Name: "Done", OptionIDs: []string{NewId()}},
			},
		},
	}
	props, _ := kanban.ToProps()
	return props
}

func validView() *View {
	return &View{
		Id:        NewId(),
		ChannelId: NewId(),
		CreatorId: NewId(),
		Type:      ViewTypeKanban,
		Title:     "My Kanban",
		Props:     validKanbanProps(),
		CreateAt:  1,
		UpdateAt:  1,
	}
}

func TestViewIsValid(t *testing.T) {
	testCases := []struct {
		Description string
		View        *View
		Valid       bool
	}{
		{
			"valid view",
			validView(),
			true,
		},
		{
			"missing id",
			&View{
				ChannelId: NewId(),
				CreatorId: NewId(),
				Type:      ViewTypeKanban,
				Title:     "My Kanban",
				CreateAt:  1,
				UpdateAt:  1,
			},
			false,
		},
		{
			"invalid id",
			func() *View { v := validView(); v.Id = "invalid"; return v }(),
			false,
		},
		{
			"missing channel id",
			func() *View { v := validView(); v.ChannelId = ""; return v }(),
			false,
		},
		{
			"invalid channel id",
			func() *View { v := validView(); v.ChannelId = "invalid"; return v }(),
			false,
		},
		{
			"missing creator id",
			func() *View { v := validView(); v.CreatorId = ""; return v }(),
			false,
		},
		{
			"invalid creator id",
			func() *View { v := validView(); v.CreatorId = "invalid"; return v }(),
			false,
		},
		{
			"invalid type",
			func() *View { v := validView(); v.Type = "invalid"; return v }(),
			false,
		},
		{
			"empty title",
			func() *View { v := validView(); v.Title = ""; return v }(),
			false,
		},
		{
			"title at max length",
			func() *View { v := validView(); v.Title = strings.Repeat("a", ViewTitleMaxRunes); return v }(),
			true,
		},
		{
			"title exceeds max length",
			func() *View { v := validView(); v.Title = strings.Repeat("a", ViewTitleMaxRunes+1); return v }(),
			false,
		},
		{
			"description at max length",
			func() *View {
				v := validView()
				v.Description = strings.Repeat("a", ViewDescriptionMaxRunes)
				return v
			}(),
			true,
		},
		{
			"description exceeds max length",
			func() *View {
				v := validView()
				v.Description = strings.Repeat("a", ViewDescriptionMaxRunes+1)
				return v
			}(),
			false,
		},
		{
			"missing create_at",
			func() *View { v := validView(); v.CreateAt = 0; return v }(),
			false,
		},
		{
			"missing update_at",
			func() *View { v := validView(); v.UpdateAt = 0; return v }(),
			false,
		},
		{
			"valid view with custom kanban props",
			func() *View {
				v := validView()
				v.Props = validKanbanProps()
				return v
			}(),
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			if tc.Valid {
				require.Nil(t, tc.View.IsValid())
			} else {
				require.NotNil(t, tc.View.IsValid())
			}
		})
	}
}

func TestViewPreSave(t *testing.T) {
	t.Run("generates id if empty", func(t *testing.T) {
		v := &View{Type: ViewTypeKanban, Title: "Kanban"}
		v.PreSave()
		assert.True(t, IsValidId(v.Id))
	})

	t.Run("keeps existing id", func(t *testing.T) {
		id := NewId()
		v := &View{Id: id, Type: ViewTypeKanban, Title: "Kanban"}
		v.PreSave()
		assert.Equal(t, id, v.Id)
	})

	t.Run("sets create_at and update_at", func(t *testing.T) {
		v := &View{Type: ViewTypeKanban, Title: "Kanban"}
		v.PreSave()
		assert.NotZero(t, v.CreateAt)
		assert.Equal(t, v.CreateAt, v.UpdateAt)
	})

	t.Run("keeps existing create_at", func(t *testing.T) {
		v := &View{Type: ViewTypeKanban, Title: "Kanban", CreateAt: 42}
		v.PreSave()
		assert.Equal(t, int64(42), v.CreateAt)
	})

	t.Run("sets delete_at to zero", func(t *testing.T) {
		v := &View{Type: ViewTypeKanban, Title: "Kanban", DeleteAt: 99}
		v.PreSave()
		assert.Zero(t, v.DeleteAt)
	})
}

func TestViewPreUpdate(t *testing.T) {
	v := validView()
	originalUpdateAt := v.UpdateAt

	v.PreUpdate()

	assert.Greater(t, v.UpdateAt, originalUpdateAt)
}

func TestViewClone(t *testing.T) {
	t.Run("nil props clones without panicking", func(t *testing.T) {
		v := validView()
		v.Props = nil
		clone := v.Clone()
		require.NotNil(t, clone)
		assert.Nil(t, clone.Props)
	})

	t.Run("scalar fields are equal", func(t *testing.T) {
		v := validView()
		clone := v.Clone()
		assert.Equal(t, v.Id, clone.Id)
		assert.Equal(t, v.ChannelId, clone.ChannelId)
		assert.Equal(t, v.Title, clone.Title)
	})

	t.Run("props are independently copied", func(t *testing.T) {
		v := validView()
		v.Props = StringInterface{"key": "value"}
		clone := v.Clone()
		require.NotNil(t, clone.Props)
		assert.NotSame(t, &v.Props, &clone.Props)
		assert.Equal(t, v.Props["key"], clone.Props["key"])

		clone.Props["key"] = "mutated"
		assert.Equal(t, "value", v.Props["key"], "original Props must not be affected")
	})
}

func TestViewPatch(t *testing.T) {
	testCases := []struct {
		Description string
		Patch       *ViewPatch
		Check       func(t *testing.T, v *View)
	}{
		{
			"patches title",
			&ViewPatch{Title: NewPointer("New Title")},
			func(t *testing.T, v *View) {
				assert.Equal(t, "New Title", v.Title)
			},
		},
		{
			"patches description",
			&ViewPatch{Description: NewPointer("A description")},
			func(t *testing.T, v *View) {
				assert.Equal(t, "A description", v.Description)
			},
		},
		{
			"patches sort_order",
			&ViewPatch{SortOrder: NewPointer(5)},
			func(t *testing.T, v *View) {
				assert.Equal(t, 5, v.SortOrder)
			},
		},
		{
			"patches props",
			&ViewPatch{Props: &StringInterface{"foo": "bar"}},
			func(t *testing.T, v *View) {
				require.NotNil(t, v.Props)
				assert.Equal(t, "bar", v.Props["foo"])
			},
		},
		{
			"nil fields are not applied",
			&ViewPatch{},
			func(t *testing.T, v *View) {
				assert.Equal(t, "My Kanban", v.Title)
				assert.Empty(t, v.Description)
				assert.Zero(t, v.SortOrder)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			v := validView()
			v.Patch(tc.Patch)
			tc.Check(t, v)
		})
	}

	t.Run("patched props are independent from patch source", func(t *testing.T) {
		patchProps := &StringInterface{"key": "value"}
		v := validView()
		v.Patch(&ViewPatch{Props: patchProps})
		require.NotNil(t, v.Props)

		(*patchProps)["key"] = "mutated"
		assert.Equal(t, "value", v.Props["key"], "view Props must not be affected by patch mutation")
	})
}

func TestKanbanPropsValidation(t *testing.T) {
	t.Run("nil props rejected for kanban", func(t *testing.T) {
		v := validView()
		v.Props = nil
		require.NotNil(t, v.IsValid())
	})

	t.Run("empty props rejected for kanban", func(t *testing.T) {
		v := validView()
		v.Props = StringInterface{}
		require.NotNil(t, v.IsValid())
	})

	t.Run("missing field_id rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: "",
				Columns: []KanbanColumn{
					{ID: NewId(), Name: "Todo", OptionIDs: []string{NewId()}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("invalid field_id rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: "not-a-valid-id",
				Columns: []KanbanColumn{
					{ID: NewId(), Name: "Todo", OptionIDs: []string{NewId()}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("empty columns rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: []KanbanColumn{},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("too many columns rejected", func(t *testing.T) {
		columns := make([]KanbanColumn, MaxKanbanColumns+1)
		for i := range columns {
			columns[i] = KanbanColumn{ID: NewId(), Name: "Col", OptionIDs: []string{NewId()}}
		}
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: columns,
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("max columns accepted", func(t *testing.T) {
		columns := make([]KanbanColumn, MaxKanbanColumns)
		for i := range columns {
			columns[i] = KanbanColumn{ID: NewId(), Name: "Col", OptionIDs: []string{NewId()}}
		}
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: columns,
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.Nil(t, v.IsValid())
	})

	t.Run("column missing id rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: []KanbanColumn{
					{ID: "", Name: "Todo", OptionIDs: []string{NewId()}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("column empty name rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: []KanbanColumn{
					{ID: NewId(), Name: "", OptionIDs: []string{NewId()}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("column empty option_ids rejected", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: []KanbanColumn{
					{ID: NewId(), Name: "Todo", OptionIDs: []string{}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.NotNil(t, v.IsValid())
	})

	t.Run("column with multiple option_ids accepted", func(t *testing.T) {
		kanban := &KanbanProps{
			GroupBy: KanbanGroupBy{
				FieldID: NewId(),
				Columns: []KanbanColumn{
					{ID: NewId(), Name: "Todo", OptionIDs: []string{NewId(), NewId()}},
				},
			},
		}
		props, _ := kanban.ToProps()
		v := validView()
		v.Props = props
		require.Nil(t, v.IsValid())
	})
}

func TestKanbanPropsRoundTrip(t *testing.T) {
	original := &KanbanProps{
		GroupBy: KanbanGroupBy{
			FieldID: NewId(),
			Columns: []KanbanColumn{
				{ID: NewId(), Name: "Todo", OptionIDs: []string{NewId()}},
				{ID: NewId(), Name: "Done", OptionIDs: []string{NewId(), NewId()}},
			},
		},
	}

	props, err := original.ToProps()
	require.NoError(t, err)

	parsed, err := KanbanPropsFromProps(props)
	require.NoError(t, err)

	assert.Equal(t, original.GroupBy.FieldID, parsed.GroupBy.FieldID)
	require.Len(t, parsed.GroupBy.Columns, 2)
	assert.Equal(t, original.GroupBy.Columns[0].Name, parsed.GroupBy.Columns[0].Name)
	assert.Equal(t, original.GroupBy.Columns[1].OptionIDs, parsed.GroupBy.Columns[1].OptionIDs)
}
