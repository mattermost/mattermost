// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type LdapInterface interface {
	DoLogin(team *model.Team, id string, password string) (*model.User, *model.AppError)
}

var theLdapInterface LdapInterface

func RegisterLdapInterface(newInterface LdapInterface) {
	theLdapInterface = newInterface
}

func GetLdapInterface() LdapInterface {
	return theLdapInterface
}
