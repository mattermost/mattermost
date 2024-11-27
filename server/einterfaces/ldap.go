// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type LdapInterface interface {
	DoLogin(c request.CTX, id string, password string) (*model.User, *model.AppError)
	GetUser(c request.CTX, id string) (*model.User, *model.AppError)
	GetUserAttributes(rctx request.CTX, id string, attributes []string) (map[string]string, *model.AppError)
	CheckPassword(c request.CTX, id string, password string) *model.AppError
	CheckPasswordAuthData(c request.CTX, authData string, password string) *model.AppError
	CheckProviderAttributes(c request.CTX, LS *model.LdapSettings, ouser *model.User, patch *model.UserPatch) string
	SwitchToLdap(c request.CTX, userID, ldapID, ldapPassword string) *model.AppError
	StartSynchronizeJob(c request.CTX, waitForJobToFinish bool, includeRemovedMembers bool) (*model.Job, *model.AppError)
	GetAllLdapUsers(c request.CTX) ([]*model.User, *model.AppError)
	MigrateIDAttribute(c request.CTX, toAttribute string) error
	GetGroup(rctx request.CTX, groupUID string) (*model.Group, *model.AppError)
	GetAllGroupsPage(rctx request.CTX, page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError)
	FirstLoginSync(c request.CTX, user *model.User, userAuthService, userAuthData, email string) *model.AppError
	UpdateProfilePictureIfNecessary(request.CTX, model.User, model.Session)
	GetADLdapIdFromSAMLId(c request.CTX, authData string) string
	GetSAMLIdFromADLdapId(c request.CTX, authData string) string
}

type LdapDiagnosticInterface interface {
	RunTest(rctx request.CTX) *model.AppError
	GetVendorNameAndVendorVersion(rctx request.CTX) (string, string, error)
}
