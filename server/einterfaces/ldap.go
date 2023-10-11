// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type LdapInterface interface {
	DoLogin(c *request.Context, id string, password string) (*model.User, *model.AppError)
	GetUser(c *request.Context, id string) (*model.User, *model.AppError)
	GetUserAttributes(id string, attributes []string) (map[string]string, *model.AppError)
	CheckPassword(c *request.Context, id string, password string) *model.AppError
	CheckPasswordAuthData(c *request.Context, authData string, password string) *model.AppError
	CheckProviderAttributes(c *request.Context, LS *model.LdapSettings, ouser *model.User, patch *model.UserPatch) string
	SwitchToLdap(c *request.Context, userID, ldapID, ldapPassword string) *model.AppError
	StartSynchronizeJob(c *request.Context, waitForJobToFinish bool, includeRemovedMembers bool) (*model.Job, *model.AppError)
	RunTest() *model.AppError
	GetAllLdapUsers(c *request.Context) ([]*model.User, *model.AppError)
	MigrateIDAttribute(c *request.Context, toAttribute string) error
	GetGroup(groupUID string) (*model.Group, *model.AppError)
	GetAllGroupsPage(page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError)
	FirstLoginSync(c *request.Context, user *model.User, userAuthService, userAuthData, email string) *model.AppError
	UpdateProfilePictureIfNecessary(*request.Context, model.User, model.Session)
	GetADLdapIdFromSAMLId(c *request.Context, authData string) string
	GetSAMLIdFromADLdapId(c *request.Context, authData string) string
	GetVendorNameAndVendorVersion() (string, string)
}
