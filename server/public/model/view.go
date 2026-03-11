// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

type ViewType string
type SubviewType string

const (
	ViewTypeBoard ViewType = "board"

	SubviewTypeKanban SubviewType = "kanban"

	ViewTitleMaxRunes       = 256
	ViewDescriptionMaxRunes = 1024
	ViewIconMaxRunes        = 256
	SubviewTitleMaxRunes    = 256
	ViewMaxSubviews         = 50
	ViewMaxLinkedProperties = 500
	MaxViewsPerChannel      = 50

	BoardsPropertyGroupName      = "boards"
	BoardsPropertyFieldNameBoard = "board"
)

type View struct {
	Id          string          `json:"id"`
	ChannelId   string          `json:"channel_id"`
	Type        ViewType        `json:"type"`
	CreatorId   string          `json:"creator_id"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Icon        string          `json:"icon,omitempty"`
	SortOrder   int             `json:"sort_order"`
	Props       *ViewBoardProps `json:"props,omitempty"`
	CreateAt    int64           `json:"create_at"`
	UpdateAt    int64           `json:"update_at"`
	DeleteAt    int64           `json:"delete_at"`
}

type ViewBoardProps struct {
	LinkedProperties []string  `json:"linked_properties"`
	Subviews         []Subview `json:"subviews"`
}

type Subview struct {
	Id    string      `json:"id"`
	Title string      `json:"title"`
	Type  SubviewType `json:"type"`
}

func (s *Subview) PreSave() {
	if s.Id == "" {
		s.Id = NewId()
	}
}

func (s *Subview) IsValid() *AppError {
	if !IsValidId(s.Id) {
		return NewAppError("Subview.IsValid", "model.subview.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if strings.TrimSpace(s.Title) == "" {
		return NewAppError("Subview.IsValid", "model.subview.is_valid.title.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(s.Title) > SubviewTitleMaxRunes {
		return NewAppError("Subview.IsValid", "model.subview.is_valid.title_length.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if s.Type != SubviewTypeKanban {
		return NewAppError("Subview.IsValid", "model.subview.is_valid.type.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	return nil
}

type ViewPatch struct {
	Title       *string         `json:"title"`
	Description *string         `json:"description"`
	Icon        *string         `json:"icon"`
	SortOrder   *int            `json:"sort_order"`
	Props       *ViewBoardProps `json:"props"`
}

type ViewsWithCount struct {
	Views      []*View `json:"views"`
	TotalCount int64   `json:"total_count"`
}

const ViewQueryDefaultPerPage = 20
const ViewQueryMaxPerPage = 200

type ViewQueryOpts struct {
	IncludeDeleted bool
	// Page is the 0-based page number for limit/offset pagination.
	Page int
	// PerPage specifies the page size. Zero defaults to ViewQueryDefaultPerPage (20).
	// Values above ViewQueryMaxPerPage (200) are clamped to ViewQueryMaxPerPage.
	PerPage int
}

func (o *View) Auditable() map[string]any {
	return map[string]any{
		"id":         o.Id,
		"channel_id": o.ChannelId,
		"type":       o.Type,
		"creator_id": o.CreatorId,
		"create_at":  o.CreateAt,
		"update_at":  o.UpdateAt,
		"delete_at":  o.DeleteAt,
	}
}

func (p *ViewBoardProps) Clone() *ViewBoardProps {
	if p == nil {
		return nil
	}
	clone := &ViewBoardProps{}
	if p.LinkedProperties != nil {
		clone.LinkedProperties = make([]string, len(p.LinkedProperties))
		copy(clone.LinkedProperties, p.LinkedProperties)
	}
	if p.Subviews != nil {
		clone.Subviews = make([]Subview, len(p.Subviews))
		copy(clone.Subviews, p.Subviews)
	}
	return clone
}

func (o *View) Clone() *View {
	if o == nil {
		return nil
	}
	v := *o
	v.Props = o.Props.Clone()
	return &v
}

func (o *View) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("View.IsValid", "model.view.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("View.IsValid", "model.view.is_valid.channel_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidId(o.CreatorId) {
		return NewAppError("View.IsValid", "model.view.is_valid.creator_id.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type != ViewTypeBoard {
		return NewAppError("View.IsValid", "model.view.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if strings.TrimSpace(o.Title) == "" || utf8.RuneCountInString(o.Title) > ViewTitleMaxRunes {
		return NewAppError("View.IsValid", "model.view.is_valid.title.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Description) > ViewDescriptionMaxRunes {
		return NewAppError("View.IsValid", "model.view.is_valid.description.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Icon) > ViewIconMaxRunes {
		return NewAppError("View.IsValid", "model.view.is_valid.icon.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("View.IsValid", "model.view.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("View.IsValid", "model.view.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.Type == ViewTypeBoard {
		if o.Props == nil || len(o.Props.Subviews) == 0 || len(o.Props.Subviews) > ViewMaxSubviews {
			return NewAppError("View.IsValid", "model.view.is_valid.props.subviews.app_error", nil, "id="+o.Id, http.StatusBadRequest)
		}
		if len(o.Props.LinkedProperties) == 0 || len(o.Props.LinkedProperties) > ViewMaxLinkedProperties {
			return NewAppError("View.IsValid", "model.view.is_valid.props.linked_properties.app_error", nil, "id="+o.Id, http.StatusBadRequest)
		}
		for _, linkedProperty := range o.Props.LinkedProperties {
			if !IsValidId(linkedProperty) {
				return NewAppError("View.IsValid", "model.view.is_valid.props.linked_properties.invalid_id.app_error", nil, "id="+o.Id+" invalid_linked_property="+linkedProperty, http.StatusBadRequest)
			}
		}
		for _, subview := range o.Props.Subviews {
			if err := subview.IsValid(); err != nil {
				return err
			}
		}
	}

	return nil
}

func (o *View) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
	o.UpdateAt = o.CreateAt
	o.DeleteAt = 0

	if o.Props != nil {
		for i := range o.Props.Subviews {
			o.Props.Subviews[i].PreSave()
		}
	}
}

func (o *View) PreUpdate() {
	o.UpdateAt = GetMillis()

	if o.Props != nil {
		for i := range o.Props.Subviews {
			o.Props.Subviews[i].PreSave()
		}
	}
}

func (o *View) Patch(patch *ViewPatch) {
	if patch == nil {
		return
	}
	if patch.Title != nil {
		o.Title = *patch.Title
	}
	if patch.Description != nil {
		o.Description = *patch.Description
	}
	if patch.Icon != nil {
		o.Icon = *patch.Icon
	}
	if patch.SortOrder != nil {
		o.SortOrder = *patch.SortOrder
	}
	if patch.Props != nil {
		o.Props = patch.Props.Clone()
	}
}
