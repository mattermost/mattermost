// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	l4g "github.com/alecthomas/log4go"

	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type JobServer struct {
	Config     model.ConfigFunc
	Store      store.Store
	Workers    *Workers
	Schedulers *Schedulers

	DataRetentionJob        ejobs.DataRetentionJobInterface
	MessageExportJob        ejobs.MessageExportJobInterface
	ElasticsearchAggregator ejobs.ElasticsearchAggregatorInterface
	ElasticsearchIndexer    ejobs.ElasticsearchIndexerInterface
	LdapSync                ejobs.LdapSyncInterface
}

func NewJobServer(config model.ConfigFunc, store store.Store) *JobServer {
	return &JobServer{
		Config: config,
		Store:  store,
	}
}

func (srv *JobServer) LoadLicense() {
	licenseId := ""
	if result := <-srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	var licenseBytes []byte

	if len(licenseId) != 26 {
		// Lets attempt to load the file from disk since it was missing from the DB
		_, licenseBytes = utils.GetAndValidateLicenseFileFromDisk()
	} else {
		if result := <-srv.Store.License().Get(licenseId); result.Err == nil {
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

func (srv *JobServer) StartWorkers() {
	srv.Workers = srv.InitWorkers().Start()
}

func (srv *JobServer) StartSchedulers() {
	srv.Schedulers = srv.InitSchedulers().Start()
}

func (srv *JobServer) StopWorkers() {
	if srv.Workers != nil {
		srv.Workers.Stop()
	}
}

func (srv *JobServer) StopSchedulers() {
	if srv.Schedulers != nil {
		srv.Schedulers.Stop()
	}
}
