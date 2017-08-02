// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

type JobServer struct {
	Store      store.Store
	Workers    *Workers
	Schedulers *Schedulers
}

var Srv JobServer

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

func (server *JobServer) StartWorkers() {
	Srv.Workers = InitWorkers().Start()
}

func (server *JobServer) StartSchedulers() {
	Srv.Schedulers = InitSchedulers().Start()
}

func (server *JobServer) StopWorkers() {
	if Srv.Workers != nil {
		Srv.Workers.Stop()
	}
}

func (server *JobServer) StopSchedulers() {
	if Srv.Schedulers != nil {
		Srv.Schedulers.Stop()
	}
}
