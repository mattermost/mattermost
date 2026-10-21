// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	RecentSearchTypeMessages    = "messages"
	RecentSearchTypeFiles       = "files"
	RecentSearchMaxTermsRunes   = 2048
	RecentSearchLimit           = 5
	RecentSearchWSActionSave    = "save"
	RecentSearchWSActionDelete  = "delete"
)

// RecentSearch is one persisted message or file search for a user.
type RecentSearch struct {
	Id         string `json:"id"`
	UserId     string `json:"user_id"`
	Terms      string `json:"terms"`
	SearchType string `json:"search_type"`
	TeamId     string `json:"team_id"`
	CreateAt   int64  `json:"create_at"`
	UpdateAt   int64  `json:"update_at"`
}

// RecentSearchList is the GET response envelope.
type RecentSearchList struct {
	Items []*RecentSearch `json:"items"`
}

func (r *RecentSearch) PreSave() {
	if r.Id == "" {
		r.Id = NewId()
	}
	r.Terms = strings.TrimSpace(r.Terms)
	if r.TeamId == "" {
		r.TeamId = ""
	}

	now := GetMillis()
	if r.CreateAt == 0 {
		r.CreateAt = now
	}
	r.UpdateAt = now
}

func (r *RecentSearch) IsValid() *AppError {
	if !IsValidId(r.Id) {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.id.app_error", nil, "id="+r.Id, http.StatusBadRequest)
	}
	if !IsValidId(r.UserId) {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.user_id.app_error", nil, "user_id="+r.UserId, http.StatusBadRequest)
	}
	if r.TeamId != "" && !IsValidId(r.TeamId) {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.team_id.app_error", nil, "team_id="+r.TeamId, http.StatusBadRequest)
	}
	if r.Terms == "" {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.terms.app_error", nil, "", http.StatusBadRequest)
	}
	if utf8.RuneCountInString(r.Terms) > RecentSearchMaxTermsRunes {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.terms_length.app_error", nil, "", http.StatusBadRequest)
	}
	if r.SearchType != RecentSearchTypeMessages && r.SearchType != RecentSearchTypeFiles {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.search_type.app_error", nil, "search_type="+r.SearchType, http.StatusBadRequest)
	}
	if r.CreateAt == 0 {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}
	if r.UpdateAt == 0 {
		return NewAppError("RecentSearch.IsValid", "model.recent_search.is_valid.update_at.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}
