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

	WikiPropertyGroupID = "pgswikipagesdefaultgroup00"
	WikiPropertyFieldID = "pfwikipagesdefaultfield000"
)

type Wiki struct {
	Id          string `json:"id"`
	ChannelId   string `json:"channel_id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	CreateAt    int64  `json:"create_at"`
	UpdateAt    int64  `json:"update_at"`
	DeleteAt    int64  `json:"delete_at"`
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
		"create_at":   w.CreateAt,
		"update_at":   w.UpdateAt,
		"delete_at":   w.DeleteAt,
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
