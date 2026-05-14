// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"maps"
	"net/http"
	"strings"
	"unicode/utf8"
)

type ViewType string

const (
	ViewTypeKanban ViewType = "kanban"

	ViewTitleMaxRunes       = 256
	ViewDescriptionMaxRunes = 1024
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
	SortOrder   int             `json:"sort_order"`
	Props       StringInterface `json:"props,omitempty"`
	CreateAt    int64           `json:"create_at"`
	UpdateAt    int64           `json:"update_at"`
	DeleteAt    int64           `json:"delete_at"`
}

type ViewPatch struct {
	Title       *string          `json:"title"`
	Description *string          `json:"description"`
	SortOrder   *int             `json:"sort_order"`
	Props       *StringInterface `json:"props"`
}

type ViewsWithCount struct {
	Views      []*View `json:"views"`
	TotalCount int64   `json:"total_count"`
}

const ViewQueryDefaultPerPage = 20
const ViewQueryMaxPerPage = 200

type ViewQueryOpts struct {
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

func (o *View) Clone() *View {
	if o == nil {
		return nil
	}
	v := *o
	if o.Props != nil {
		v.Props = make(StringInterface, len(o.Props))
		maps.Copy(v.Props, o.Props)
	}
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

	if o.Type != ViewTypeKanban {
		return NewAppError("View.IsValid", "model.view.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if strings.TrimSpace(o.Title) == "" || utf8.RuneCountInString(o.Title) > ViewTitleMaxRunes {
		return NewAppError("View.IsValid", "model.view.is_valid.title.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.Description) > ViewDescriptionMaxRunes {
		return NewAppError("View.IsValid", "model.view.is_valid.description.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("View.IsValid", "model.view.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("View.IsValid", "model.view.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if err := validateViewProps(o.Type, o.Props); err != nil {
		return err
	}

	return nil
}

// validateViewProps validates the props map based on the view type.
// As we add new view types with specific prop requirements, add validation rules here.
func validateViewProps(_ ViewType, _ StringInterface) *AppError {
	// ViewTypeKanban: no required props at this time.
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
}

func (o *View) PreUpdate() {
	o.UpdateAt = GetMillis()
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
	if patch.SortOrder != nil {
		o.SortOrder = *patch.SortOrder
	}
	if patch.Props != nil {
		o.Props = make(StringInterface, len(*patch.Props))
		maps.Copy(o.Props, *patch.Props)
	}
}
