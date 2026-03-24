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
		Props: &ViewBoardProps{
			LinkedProperties: []string{NewId()},
			Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
		},
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
			"valid view with valid subview and linked property",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					LinkedProperties: []string{NewId()},
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			true,
		},
		{
			"board requires props",
			func() *View { v := validView(); v.Props = nil; return v }(),
			false,
		},
		{
			"board requires at least one subview",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{LinkedProperties: []string{NewId()}, Subviews: nil}
				return v
			}(),
			false,
		},
		{
			"board requires at least one linked property",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{Subviews: []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}}}
				return v
			}(),
			false,
		},
		{
			"board rejects invalid linked property id",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					LinkedProperties: []string{"invalid-id"},
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			false,
		},
		{
			"board rejects empty linked property id",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					LinkedProperties: []string{NewId(), ""},
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			false,
		},
		{
			"view with invalid subview id",
			func() *View {
				v := validView()
				v.Props = &ViewBoardProps{
					LinkedProperties: []string{NewId()},
					Subviews:         []Subview{{Id: "invalid", Title: "Kanban", Type: SubviewTypeKanban}},
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
					LinkedProperties: []string{NewId()},
					Subviews:         []Subview{{Id: NewId(), Title: "", Type: SubviewTypeKanban}},
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
					LinkedProperties: []string{NewId()},
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: "invalid"}},
				}
				return v
			}(),
			false,
		},
		{
			"board rejects too many subviews",
			func() *View {
				v := validView()
				subviews := make([]Subview, ViewMaxSubviews+1)
				for i := range subviews {
					subviews[i] = Subview{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}
				}
				v.Props = &ViewBoardProps{LinkedProperties: []string{NewId()}, Subviews: subviews}
				return v
			}(),
			false,
		},
		{
			"board allows max subviews",
			func() *View {
				v := validView()
				subviews := make([]Subview, ViewMaxSubviews)
				for i := range subviews {
					subviews[i] = Subview{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}
				}
				v.Props = &ViewBoardProps{LinkedProperties: []string{NewId()}, Subviews: subviews}
				return v
			}(),
			true,
		},
		{
			"board rejects too many linked properties",
			func() *View {
				v := validView()
				props := make([]string, ViewMaxLinkedProperties+1)
				for i := range props {
					props[i] = NewId()
				}
				v.Props = &ViewBoardProps{
					LinkedProperties: props,
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
				return v
			}(),
			false,
		},
		{
			"board allows max linked properties",
			func() *View {
				v := validView()
				props := make([]string, ViewMaxLinkedProperties)
				for i := range props {
					props[i] = NewId()
				}
				v.Props = &ViewBoardProps{
					LinkedProperties: props,
					Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
				}
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

func TestViewBoardPropsClone(t *testing.T) {
	t.Run("nil receiver returns nil", func(t *testing.T) {
		var p *ViewBoardProps
		assert.Nil(t, p.Clone())
	})

	t.Run("nil slices stay nil", func(t *testing.T) {
		p := &ViewBoardProps{}
		clone := p.Clone()
		require.NotNil(t, clone)
		assert.Nil(t, clone.LinkedProperties)
		assert.Nil(t, clone.Subviews)
	})

	t.Run("populated slices are independent copies", func(t *testing.T) {
		p := &ViewBoardProps{
			LinkedProperties: []string{"a", "b"},
			Subviews: []Subview{
				{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban},
			},
		}
		clone := p.Clone()
		require.NotNil(t, clone)
		assert.Equal(t, p.LinkedProperties, clone.LinkedProperties)
		assert.Equal(t, p.Subviews, clone.Subviews)

		clone.LinkedProperties[0] = "mutated"
		assert.Equal(t, "a", p.LinkedProperties[0], "original LinkedProperties must not be affected")

		clone.Subviews[0].Title = "mutated"
		assert.Equal(t, "Kanban", p.Subviews[0].Title, "original Subviews must not be affected")
	})

	t.Run("appending to clone does not affect original", func(t *testing.T) {
		p := &ViewBoardProps{
			LinkedProperties: []string{"a"},
			Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
		}
		clone := p.Clone()
		clone.LinkedProperties = append(clone.LinkedProperties, "b")
		clone.Subviews = append(clone.Subviews, Subview{Id: NewId(), Title: "Extra", Type: SubviewTypeKanban})
		assert.Len(t, p.LinkedProperties, 1)
		assert.Len(t, p.Subviews, 1)
	})
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

	t.Run("props are deeply copied", func(t *testing.T) {
		v := validView()
		clone := v.Clone()
		require.NotNil(t, clone.Props)
		assert.NotSame(t, v.Props, clone.Props)

		clone.Props.LinkedProperties[0] = "mutated"
		assert.NotEqual(t, "mutated", v.Props.LinkedProperties[0], "original LinkedProperties must not be affected")

		clone.Props.Subviews[0].Title = "mutated"
		assert.NotEqual(t, "mutated", v.Props.Subviews[0].Title, "original Subviews must not be affected")
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
			"patches props linked properties",
			&ViewPatch{Props: &ViewBoardProps{LinkedProperties: []string{"prop1"}}},
			func(t *testing.T, v *View) {
				require.NotNil(t, v.Props)
				assert.Equal(t, []string{"prop1"}, v.Props.LinkedProperties)
			},
		},
		{
			"patches props subview title",
			&ViewPatch{Props: &ViewBoardProps{
				LinkedProperties: []string{"prop1"},
				Subviews:         []Subview{{Id: NewId(), Title: "Updated Kanban", Type: SubviewTypeKanban}},
			}},
			func(t *testing.T, v *View) {
				require.NotNil(t, v.Props)
				require.Len(t, v.Props.Subviews, 1)
				assert.Equal(t, "Updated Kanban", v.Props.Subviews[0].Title)
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
				assert.NotNil(t, v.Props)
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
		patchProps := &ViewBoardProps{
			LinkedProperties: []string{"prop1"},
			Subviews:         []Subview{{Id: NewId(), Title: "Kanban", Type: SubviewTypeKanban}},
		}
		v := validView()
		v.Patch(&ViewPatch{Props: patchProps})
		require.NotNil(t, v.Props)
		assert.NotSame(t, patchProps, v.Props)
		assert.EqualValues(t, patchProps, v.Props)

		patchProps.LinkedProperties[0] = "mutated"
		assert.Equal(t, "prop1", v.Props.LinkedProperties[0], "view Props must not be affected by patch mutation")

		patchProps.Subviews[0].Title = "mutated"
		assert.Equal(t, "Kanban", v.Props.Subviews[0].Title, "view Props Subviews must not be affected by patch mutation")
	})
}
