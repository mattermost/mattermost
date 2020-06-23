// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package logger

import (
	"errors"
	"strings"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
)

type Admin interface {
	IsUserAdmin(mattermostUserID string) bool
	DMAdmins(format string, args ...interface{}) error
}

type defaultAdmin struct {
	poster.DMer
	AdminUserIDs []string
}

func NewAdmin(adminUserIDs string, p poster.DMer) Admin {
	return &defaultAdmin{
		DMer:         p,
		AdminUserIDs: strings.Split(adminUserIDs, ","),
	}
}

func (a *defaultAdmin) IsUserAdmin(mattermostUserID string) bool {
	for _, u := range a.AdminUserIDs {
		if mattermostUserID == strings.TrimSpace(u) {
			return true
		}
	}
	return false
}

// DM posts a simple Direct Message to the specified user
func (a *defaultAdmin) DMAdmins(format string, args ...interface{}) error {
	if a.DMer == nil {
		return errors.New("current implementation cannot DM admins, DMer not set")
	}
	for _, id := range a.AdminUserIDs {
		_, err := a.DM(id, format, args)
		if err != nil {
			return err
		}
	}
	return nil
}
