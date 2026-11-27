// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"net/url"
	"strings"
)

const (
	MobileQRLoginURLScheme = "mattermost"
	MobileQRLoginPath      = "/login/mobile_qr"
)

// MobileQRLoginToken is returned to a signed-in workstation so it can display a QR code.
type MobileQRLoginToken struct {
	Link      string `json:"link"`
	QRCode    string `json:"qr_code"`
	ExpiresAt int64  `json:"expires_at"`
}

// MobileQRLoginTokenExtra is stored in Token.Extra for tokens of type TokenTypeMobileQRLogin.
type MobileQRLoginTokenExtra struct {
	UserId          string `json:"user_id"`
	SourceSessionId string `json:"source_session_id"`
	ExpiresAt       int64  `json:"expires_at"`
}

// MobileQRLoginResponse is returned to a mobile device after it redeems a QR sign-in code.
type MobileQRLoginResponse struct {
	Token string `json:"token"`
	Csrf  string `json:"csrf"`
}

// BuildMobileQRLoginLink builds the deep link opened by the mobile app, e.g.
// https://chat.example.com/mm/ becomes mattermost://chat.example.com/mm/login/mobile_qr?t=TOKEN.
func BuildMobileQRLoginLink(siteURL, token string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(siteURL))
	if err != nil {
		return "", err
	}
	if parsed.Host == "" {
		return "", errors.New("site URL has no host")
	}

	link := url.URL{
		Scheme:   MobileQRLoginURLScheme,
		Host:     parsed.Host,
		Path:     strings.TrimRight(parsed.Path, "/") + MobileQRLoginPath,
		RawQuery: url.Values{"t": {token}}.Encode(),
	}
	return link.String(), nil
}
