// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type LdapInterface interface {
	DoLogin(rctx request.CTX, id string, password string) (*model.User, *model.AppError)
	GetUser(rctx request.CTX, id string) (*model.User, *model.AppError)
	GetLDAPUserForMMUser(rctx request.CTX, mmUser *model.User) (*model.User, string, *model.AppError)
	GetUserAttributes(rctx request.CTX, id string, attributes []string) (map[string]string, *model.AppError)
	CheckProviderAttributes(rctx request.CTX, LS *model.LdapSettings, ouser *model.User, patch *model.UserPatch) string
	SwitchToLdap(rctx request.CTX, userID, ldapID, ldapPassword string) *model.AppError
	StartSynchronizeJob(rctx request.CTX, waitForJobToFinish bool) (*model.Job, *model.AppError)
	GetAllLdapUsers(rctx request.CTX) ([]*model.User, *model.AppError)
	MigrateIDAttribute(rctx request.CTX, toAttribute string) error
	GetGroup(rctx request.CTX, groupUID string) (*model.Group, *model.AppError)
	GetAllGroupsPage(rctx request.CTX, page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError)
	FirstLoginSync(rctx request.CTX, user *model.User) *model.AppError
	UpdateProfilePictureIfNecessary(request.CTX, model.User, model.Session)
}

type LdapDiagnosticInterface interface {
	RunTest(rctx request.CTX) *model.AppError
	GetVendorNameAndVendorVersion(rctx request.CTX) (string, string, error)
	RunTestConnection(rctx request.CTX, settings model.LdapSettings) *model.AppError
	RunTestDiagnostics(rctx request.CTX, testType model.LdapDiagnosticTestType, settings model.LdapSettings) ([]model.LdapDiagnosticResult, *model.AppError)
}
