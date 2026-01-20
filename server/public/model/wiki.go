// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"unicode/utf8"
)

const (
	WikiTitleMaxRunes       = 128
	WikiDescriptionMaxRunes = 1024
	WikiIconMaxLength       = 256

	// Page status values - these are stored directly as display names
	// following the Mattermost pattern (see ContentFlaggingStatus* constants)
	PageStatusRoughDraft = "Rough draft"
	PageStatusInProgress = "In progress"
	PageStatusInReview   = "In review"
	PageStatusDone       = "Done"
)

type Wiki struct {
	Id          string          `json:"id"`
	ChannelId   string          `json:"channel_id"`
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Icon        string          `json:"icon,omitempty"`
	Props       StringInterface `json:"props"`
	CreateAt    int64           `json:"create_at"`
	UpdateAt    int64           `json:"update_at"`
	DeleteAt    int64           `json:"delete_at"`
	SortOrder   int64           `json:"sort_order"`
}

func (w *Wiki) PreSave() {
	if w.Id == "" {
		w.Id = NewId()
	}

	w.Title = SanitizeUnicode(w.Title)
	w.Description = SanitizeUnicode(w.Description)

	if w.CreateAt == 0 {
		w.CreateAt = GetMillis()
	}
	w.UpdateAt = w.CreateAt

	if w.SortOrder == 0 {
		w.SortOrder = w.CreateAt
	}
}

func (w *Wiki) PreUpdate() {
	w.UpdateAt = GetMillis()
	w.Title = SanitizeUnicode(w.Title)
	w.Description = SanitizeUnicode(w.Description)
}

func (w *Wiki) Auditable() map[string]any {
	return map[string]any{
		"id":          w.Id,
		"channel_id":  w.ChannelId,
		"title":       w.Title,
		"description": w.Description,
		"icon":        w.Icon,
		"props":       w.GetProps(),
		"create_at":   w.CreateAt,
		"update_at":   w.UpdateAt,
		"delete_at":   w.DeleteAt,
		"sort_order":  w.SortOrder,
	}
}

func (w *Wiki) LogClone() any {
	return w.Auditable()
}

func (w *Wiki) IsValid() *AppError {
	if !IsValidId(w.Id) {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if w.CreateAt == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.create_at.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if w.UpdateAt == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.update_at.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if !IsValidId(w.ChannelId) {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Title) == 0 {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.title.app_error", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Title) > WikiTitleMaxRunes {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.title_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(w.Description) > WikiDescriptionMaxRunes {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.description_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	if len(w.Icon) > WikiIconMaxLength {
		return NewAppError("Wiki.IsValid", "model.wiki.is_valid.icon_length.app_error", nil, "id="+w.Id, http.StatusBadRequest)
	}

	return nil
}

func (w *Wiki) ToJSON() ([]byte, error) {
	return json.Marshal(w)
}

func WikiFromJSON(data []byte) (*Wiki, error) {
	var wiki Wiki
	if err := json.Unmarshal(data, &wiki); err != nil {
		return nil, err
	}
	return &wiki, nil
}

// BreadcrumbItem represents a single item in the breadcrumb path
type BreadcrumbItem struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Type      string `json:"type"` // "wiki", "page"
	Path      string `json:"path"`
	ChannelId string `json:"channel_id"`
}

// BreadcrumbPath represents the full breadcrumb navigation path
type BreadcrumbPath struct {
	Items       []*BreadcrumbItem `json:"items"`
	CurrentPage *BreadcrumbItem   `json:"current_page"`
}

// SetProps sets the Props field
func (w *Wiki) SetProps(props StringInterface) {
	w.Props = props
}

// GetProps returns the Props, initializing if necessary
func (w *Wiki) GetProps() StringInterface {
	if w.Props == nil {
		return make(StringInterface)
	}
	return w.Props
}

// ShowMentionsInChannelFeed returns whether page mention system messages should appear in channel feed
func (w *Wiki) ShowMentionsInChannelFeed() bool {
	if val, ok := w.Props["show_mentions_in_channel_feed"].(bool); ok {
		return val
	}
	return true // Default to true - show mentions in channel feed
}

// SetShowMentionsInChannelFeed sets the show_mentions_in_channel_feed prop
func (w *Wiki) SetShowMentionsInChannelFeed(show bool) {
	if w.Props == nil {
		w.Props = make(StringInterface)
	}
	w.Props["show_mentions_in_channel_feed"] = show
}
