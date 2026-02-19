// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validView() *View {
	return &View{
		Id:        NewId(),
		ChannelId: NewId(),
		CreatorId: NewId(),
		Type:      ViewTypeBoard,
		Title:     "My Board",
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
				Type:      ViewTypeBoard,
				Title:     "My Board",
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
			"icon at max length",
			func() *View { v := validView(); v.Icon = strings.Repeat("a", ViewIconMaxRunes); return v }(),
			true,
		},
		{
			"icon exceeds max length",
			func() *View { v := validView(); v.Icon = strings.Repeat("a", ViewIconMaxRunes+1); return v }(),
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

func TestSubviewIsValid(t *testing.T) {
	testCases := []struct {
		Description string
		Subview     *Subview
		Valid       bool
	}{
		{
			"valid subview",
			&Subview{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban},
			true,
		},
		{
			"missing id",
			&Subview{Title: "Kanban", Type: SubviewTypeKanban},
			false,
		},
		{
			"invalid id",
			&Subview{Id: "invalid", Title: "Kanban", Type: SubviewTypeKanban},
			false,
		},
		{
			"empty title",
			&Subview{Id: NewId(), Title: "", Type: SubviewTypeKanban},
			false,
		},
		{
			"empty type",
			&Subview{Id: NewId(), Title: "Kanban", Type: ""},
			false,
		},
		{
			"invalid type",
			&Subview{Id: NewId(), Title: "Kanban", Type: "invalid"},
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Description, func(t *testing.T) {
			if tc.Valid {
				require.Nil(t, tc.Subview.IsValid())
			} else {
				require.NotNil(t, tc.Subview.IsValid())
			}
		})
	}
}

func TestSubviewPreSave(t *testing.T) {
	t.Run("generates id if empty", func(t *testing.T) {
		s := &Subview{Title: "Kanban", Type: SubviewTypeKanban}
		s.PreSave()
		assert.True(t, IsValidId(s.Id))
	})

	t.Run("keeps existing id", func(t *testing.T) {
		id := NewId()
		s := &Subview{Id: id, Title: "Kanban", Type: SubviewTypeKanban}
		s.PreSave()
		assert.Equal(t, id, s.Id)
	})
}

func TestViewIsValidWithSubviews(t *testing.T) {
	testCases := []struct {
		Description string
		View        *View
		Valid       bool
	}{
		{
			"valid view with valid subview",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					Subviews: []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			true,
		},
		{
			"view with invalid subview id",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					Subviews: []Subview{{Id: "invalid", Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			false,
		},
		{
			"view with subview missing title",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					Subviews: []Subview{{Id: NewId(), Title: "", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			false,
		},
		{
			"view with subview invalid type",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					Subviews: []Subview{{Id: NewId(), Title: "Kanban", Type: "invalid"}},
				}
				return v
			}(),
			false,
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
		v := &View{Type: ViewTypeBoard, Title: "Board"}
		v.PreSave()
		assert.True(t, IsValidId(v.Id))
	})

	t.Run("keeps existing id", func(t *testing.T) {
		id := NewId()
		v := &View{Id: id, Type: ViewTypeBoard, Title: "Board"}
		v.PreSave()
		assert.Equal(t, id, v.Id)
	})

	t.Run("sets create_at and update_at", func(t *testing.T) {
		v := &View{Type: ViewTypeBoard, Title: "Board"}
		v.PreSave()
		assert.NotZero(t, v.CreateAt)
		assert.Equal(t, v.CreateAt, v.UpdateAt)
	})

	t.Run("keeps existing create_at", func(t *testing.T) {
		v := &View{Type: ViewTypeBoard, Title: "Board", CreateAt: 42}
		v.PreSave()
		assert.Equal(t, int64(42), v.CreateAt)
	})

	t.Run("generates subview ids in props", func(t *testing.T) {
		v := &View{
			Type:  ViewTypeBoard,
			Title: "Board",
			Props: &ViewBoardProps{
				Subviews: []Subview{{Title: "Kanban", Type: SubviewTypeKanban}},
			},
		}
		v.PreSave()
		assert.True(t, IsValidId(v.Props.Subviews[0].Id))
	})

	t.Run("sets delete_at to zero", func(t *testing.T) {
		v := &View{Type: ViewTypeBoard, Title: "Board", DeleteAt: 99}
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
			"patches icon",
			&ViewPatch{Icon: NewPointer("🚀")},
			func(t *testing.T, v *View) {
				assert.Equal(t, "🚀", v.Icon)
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
			&ViewPatch{Props: &ViewBoardProps{LinkedProperties: []string{"prop1"}}},
			func(t *testing.T, v *View) {
				require.NotNil(t, v.Props)
				assert.Equal(t, []string{"prop1"}, v.Props.LinkedProperties)
			},
		},
		{
			"nil fields are not applied",
			&ViewPatch{},
			func(t *testing.T, v *View) {
				assert.Equal(t, "My Board", v.Title)
				assert.Empty(t, v.Description)
				assert.Empty(t, v.Icon)
				assert.Zero(t, v.SortOrder)
				assert.Nil(t, v.Props)
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
}
