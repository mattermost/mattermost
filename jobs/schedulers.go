// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"sync"

	l4g "github.com/alecthomas/log4go"
	ejobs "github.com/mattermost/platform/einterfaces/jobs"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type Schedulers struct {
	startOnce sync.Once

	DataRetention model.Scheduler

	listenerId string
}

func InitSchedulers() *Schedulers {
	schedulers := &Schedulers{}

	if dataRetentionInterface := ejobs.GetDataRetentionInterface(); dataRetentionInterface != nil {
		schedulers.DataRetention = dataRetentionInterface.MakeScheduler()
	}

	return schedulers
}

func (schedulers *Schedulers) Start() *Schedulers {
	l4g.Info("Starting schedulers")

	schedulers.startOnce.Do(func() {
		if schedulers.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
			go schedulers.DataRetention.Run()
		}
	})

	schedulers.listenerId = utils.AddConfigListener(schedulers.handleConfigChange)

	return schedulers
}

func (schedulers *Schedulers) handleConfigChange(oldConfig *model.Config, newConfig *model.Config) {
	if schedulers.DataRetention != nil {
		if !*oldConfig.DataRetentionSettings.Enable && *newConfig.DataRetentionSettings.Enable {
			go schedulers.DataRetention.Run()
		} else if *oldConfig.DataRetentionSettings.Enable && !*newConfig.DataRetentionSettings.Enable {
			schedulers.DataRetention.Stop()
		}
	}
}

func (schedulers *Schedulers) Stop() *Schedulers {
	utils.RemoveConfigListener(schedulers.listenerId)

	if schedulers.DataRetention != nil && *utils.Cfg.DataRetentionSettings.Enable {
		schedulers.DataRetention.Stop()
	}

	l4g.Info("Stopped schedulers")

	return schedulers
}
