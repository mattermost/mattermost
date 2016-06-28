// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

const (
	USER_AUTH_SERVICE_SAML      = "saml"
	USER_AUTH_SERVICE_SAML_TEXT = "With SAML"
	SAML_IDP_CERTIFICATE        = 1
	SAML_PRIVATE_KEY            = 2
	SAML_PUBLIC_CERT            = 3
)

type SamlAuthRequest struct {
	Base64AuthRequest string
	URL               string
	RelayState        string
}
