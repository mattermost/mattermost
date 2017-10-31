// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/go-ldap/ldap"

	"github.com/mattermost/mattermost-server/model"
)

type LdapInterface interface {
	DoLogin(id string, password string) (*model.User, *model.AppError)
	GetUser(id string) (*model.User, *model.AppError)
	GetUserAttributes(id string, attributes []string) (map[string]string, *model.AppError)
	CheckPassword(id string, password string) *model.AppError
	SwitchToLdap(userId, ldapId, ldapPassword string) *model.AppError
	ValidateFilter(filter string) *model.AppError
	StartSynchronizeJob(waitForJobToFinish bool) (*model.Job, *model.AppError)
	RunTest() *model.AppError
	GetAllLdapUsers() ([]*model.User, *model.AppError)
	UserFromLdapUser(ldapUser *ldap.Entry) *model.User
	UserHasUpdateFromLdap(existingUser *model.User, currentLdapUser *model.User) bool
	UpdateLocalLdapUser(existingUser *model.User, currentLdapUser *model.User) *model.User
}
