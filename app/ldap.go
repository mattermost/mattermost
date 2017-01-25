// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func SyncLdap() {
	go func() {
		if utils.IsLicensed && *utils.License.Features.LDAP && *utils.Cfg.LdapSettings.Enable {
			if ldapI := einterfaces.GetLdapInterface(); ldapI != nil {
				ldapI.SyncNow()
			} else {
				l4g.Error("%v", model.NewLocAppError("ldapSyncNow", "ent.ldap.disabled.app_error", nil, "").Error())
			}
		}
	}()
}

func TestLdap() *model.AppError {
	if ldapI := einterfaces.GetLdapInterface(); ldapI != nil && utils.IsLicensed && *utils.License.Features.LDAP && *utils.Cfg.LdapSettings.Enable {
		if err := ldapI.RunTest(); err != nil {
			err.StatusCode = 500
			return err
		}
	} else {
		err := model.NewLocAppError("ldapTest", "ent.ldap.disabled.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	return nil
}
