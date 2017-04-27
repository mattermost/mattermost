// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package job

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type JobServer struct {
	Store store.Store
	Jobs  *Jobs
}

func (server *JobServer) LoadLicense() {
	licenseId := ""
	if result := <-server.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	var licenseBytes []byte

	if len(licenseId) != 26 {
		// Lets attempt to load the file from disk since it was missing from the DB
		_, licenseBytes = utils.GetAndValidateLicenseFileFromDisk()
	} else {
		if result := <-server.Store.License().Get(licenseId); result.Err == nil {
			record := result.Data.(*model.LicenseRecord)
			licenseBytes = []byte(record.Bytes)
			l4g.Info("License key valid unlocking enterprise features.")
		} else {
			l4g.Info(utils.T("mattermost.load_license.find.warn"))
		}
	}

	if licenseBytes != nil {
		utils.LoadLicense(licenseBytes)
		l4g.Info("License key valid unlocking enterprise features.")
	} else {
		l4g.Info(utils.T("mattermost.load_license.find.warn"))
	}
}
