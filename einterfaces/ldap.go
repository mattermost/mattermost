// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type LdapInterface interface {
	DoLogin(ctx AppContextInterface, id string, password string) (*model.User, *model.AppError)
	GetUser(id string) (*model.User, *model.AppError)
	GetUserAttributes(id string, attributes []string) (map[string]string, *model.AppError)
	CheckPassword(id string, password string) *model.AppError
	CheckPasswordAuthData(authData string, password string) *model.AppError
	CheckProviderAttributes(LS *model.LdapSettings, ouser *model.User, patch *model.UserPatch) string
	SwitchToLdap(userID, ldapID, ldapPassword string) *model.AppError
	StartSynchronizeJob(waitForJobToFinish bool) (*model.Job, *model.AppError)
	RunTest() *model.AppError
	GetAllLdapUsers() ([]*model.User, *model.AppError)
	MigrateIDAttribute(toAttribute string) error
	GetGroup(groupUID string) (*model.Group, *model.AppError)
	GetAllGroupsPage(page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError)
	FirstLoginSync(ctx AppContextInterface, user *model.User, userAuthService, userAuthData, email string) *model.AppError
	UpdateProfilePictureIfNecessary(model.User, model.Session)
	GetADLdapIdFromSAMLId(authData string) string
	GetSAMLIdFromADLdapId(authData string) string
	GetVendorNameAndVendorVersion() (string, string)
}

type AppContextInterface interface {
	T(translationID string, args ...interface{}) string
	Session() *model.Session
	RequestId() string
	IpAddress() string
	Path() string
	UserAgent() string
	AcceptLanguage() string
}
