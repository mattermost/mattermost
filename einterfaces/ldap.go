// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type LdapInterface interface {
	DoLogin(id string, password string) (*model.User, error)
	GetUser(id string) (*model.User, error)
	GetUserAttributes(id string, attributes []string) (map[string]string, error)
	CheckPassword(id string, password string) error
	CheckPasswordAuthData(authData string, password string) error
	SwitchToLdap(userId, ldapId, ldapPassword string) error
	StartSynchronizeJob(waitForJobToFinish bool) (*model.Job, error)
	RunTest() error
	GetAllLdapUsers() ([]*model.User, error)
	MigrateIDAttribute(toAttribute string) error
	GetGroup(groupUID string) (*model.Group, error)
	GetAllGroupsPage(page int, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, error)
	FirstLoginSync(userID, userAuthService, userAuthData, email string) error
}
