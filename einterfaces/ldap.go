// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type LdapInterface interface {
	DoLogin(id string, password string) (*model.User, *model.AppError)
	GetUser(id string) (*model.User, *model.AppError)
	GetUserAttributes(id string, attributes []string) (map[string]string, *model.AppError)
	CheckPassword(id string, password string) *model.AppError
	SwitchToLdap(userId, ldapId, ldapPassword string) *model.AppError
	ValidateFilter(filter string) *model.AppError
	Syncronize() *model.AppError
	StartLdapSyncJob()
	SyncNow()
	RunTest() *model.AppError
	GetAllLdapUsers() ([]*model.User, *model.AppError)
}

var theLdapInterface LdapInterface

func RegisterLdapInterface(newInterface LdapInterface) {
	theLdapInterface = newInterface
}

func GetLdapInterface() LdapInterface {
	return theLdapInterface
}
