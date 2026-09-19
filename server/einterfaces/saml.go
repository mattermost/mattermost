// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	saml2 "github.com/mattermost/gosaml2"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type SamlInterface interface {
	ConfigureSP(rctx request.CTX) error
	BuildRequest(rctx request.CTX, relayState string) (*model.SamlAuthRequest, *model.AppError)
	// DoLogin may return a non-nil user with a non-nil err when the account was provisioned
	// but a post-create step failed (e.g. LDAP FirstLoginSync or admin role assignment).
	DoLogin(rctx request.CTX, encodedXML string, relayState map[string]string) (user *model.User, assertion *saml2.AssertionInfo, userWasCreated bool, err *model.AppError)
	GetMetadata(rctx request.CTX) (string, *model.AppError)
	CheckProviderAttributes(rctx request.CTX, SS *model.SamlSettings, ouser *model.User, patch *model.UserPatch) string
}
