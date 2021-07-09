// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

const (
	TokenSize          = 64
	MaxTokenExipryTime = 1000 * 60 * 60 * 48 // 48 hour
	TokenTypeOAuth     = "oauth"
)

type Token struct {
	Token    string
	CreateAt int64
	Type     string
	Extra    string
}

func NewToken(tokentype, extra string) *Token {
	return &Token{
		Token:    NewRandomString(TokenSize),
		CreateAt: GetMillis(),
		Type:     tokentype,
		Extra:    extra,
	}
}

func (t *Token) IsValid() *AppError {
	if len(t.Token) != TokenSize {
		return NewAppError("Token.IsValid", "model.token.is_valid.size", nil, "", http.StatusInternalServerError)
	}

	if t.CreateAt == 0 {
		return NewAppError("Token.IsValid", "model.token.is_valid.expiry", nil, "", http.StatusInternalServerError)
	}

	return nil
}
