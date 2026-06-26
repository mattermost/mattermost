// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

const (
	TokenSize                 = 64
	MaxTokenExipryTime        = 1000 * 60 * 60 * 48 // 48 hour
	PasswordRecoverExpiryTime = 1000 * 60 * 60 * 24 // 24 hours
	InvitationExpiryTime      = 1000 * 60 * 60 * 48 // 48 hours
	MagicLinkExpiryTime       = 1000 * 60 * 5       // 5 minutes

	TokenTypePasswordRecovery         = "password_recovery"
	TokenTypeVerifyEmail              = "verify_email"
	TokenTypeTeamInvitation           = "team_invitation"
	TokenTypeGuestInvitation          = "guest_invitation"
	TokenTypeCWSAccess                = "cws_access_token"
	TokenTypeGuestMagicLinkInvitation = "guest_magic_link_invitation"
	TokenTypeGuestMagicLink           = "guest_magic_link"

	TokenTypeOAuth           = "oauth"
	TokenTypeSaml            = "saml"
	TokenTypeSSOCodeExchange = "sso-code-exchange"
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

// IsExpired checks if the token is expired based on the token type and expiry time
// If the token is nil, it returns true
func (t *Token) IsExpired() bool {
	if t == nil {
		return true
	}

	var expiryTime int64 = MaxTokenExipryTime
	switch t.Type {
	case TokenTypeGuestMagicLink:
		expiryTime = MagicLinkExpiryTime
	case TokenTypeGuestMagicLinkInvitation:
		expiryTime = InvitationExpiryTime
	case TokenTypePasswordRecovery:
		expiryTime = PasswordRecoverExpiryTime
	case TokenTypeVerifyEmail:
		expiryTime = PasswordRecoverExpiryTime
	case TokenTypeTeamInvitation:
		expiryTime = InvitationExpiryTime
	case TokenTypeGuestInvitation:
		expiryTime = InvitationExpiryTime
	}
	return GetMillis() > (t.CreateAt + expiryTime)
}

func (t *Token) IsGuestMagicLink() bool {
	return t.Type == TokenTypeGuestMagicLink || t.Type == TokenTypeGuestMagicLinkInvitation
}

func (t *Token) IsInvitationToken() bool {
	return t.Type == TokenTypeTeamInvitation || t.Type == TokenTypeGuestInvitation || t.Type == TokenTypeGuestMagicLinkInvitation
}
