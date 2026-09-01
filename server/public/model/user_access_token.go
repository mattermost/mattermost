// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

// NonCompliantUserAccessTokenResult is the response payload for the endpoints
// that count or revoke personal access tokens violating the maximum lifetime
// policy. Count carries the number of tokens previewed or actually revoked.
type NonCompliantUserAccessTokenResult struct {
	Count int64 `json:"count"`
}

type UserAccessToken struct {
	Id          string `json:"id"`
	Token       string `json:"token,omitempty"`
	UserId      string `json:"user_id"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
	// ExpiresAt is the Unix timestamp in milliseconds at which the token
	// expires. A value of 0 means the token does not expire. Tokens whose
	// ExpiresAt is non-zero and in the past are considered expired and
	// MUST be rejected at validation time.
	ExpiresAt int64 `json:"expires_at"`
	// LastNotifiedAt is the Unix timestamp in milliseconds at which the token
	// owner was last warned that the token is approaching expiry. It is nil until
	// the first warning is sent. The notify_expiring_access_tokens job uses it to dedup: the
	// warning bucket already covered is recovered from (ExpiresAt - LastNotifiedAt),
	// so the same (or a less urgent) warning is not re-sent every run. Storing the
	// moment rather than the bucket keeps the column independent of the day cascade
	// and correct if the buckets are later changed. It is internal server
	// bookkeeping that is never exposed over the API.
	LastNotifiedAt *int64 `json:"-"`
}

func (t *UserAccessToken) IsValid() *AppError {
	if !IsValidId(t.Id) {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Token) != 26 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.token.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(t.UserId) {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if len(t.Description) > 255 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.description.app_error", nil, "", http.StatusBadRequest)
	}

	if t.ExpiresAt < 0 {
		return NewAppError("UserAccessToken.IsValid", "model.user_access_token.is_valid.expires_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (t *UserAccessToken) PreSave() {
	t.Id = NewId()
	t.IsActive = true
}

// IsExpired reports whether the token has a non-zero ExpiresAt in the past.
// Tokens with ExpiresAt == 0 are treated as non-expiring for backwards
// compatibility with tokens that existed before expiry was introduced.
func (t *UserAccessToken) IsExpired() bool {
	if t.ExpiresAt <= 0 {
		return false
	}
	return GetMillis() >= t.ExpiresAt
}
