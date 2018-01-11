// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"runtime/debug"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) Config() *model.Config {
	return utils.Cfg
}

func (a *App) UpdateConfig(f func(*model.Config)) {
	old := utils.Cfg.Clone()
	f(utils.Cfg)
	utils.InvokeGlobalConfigListeners(old, utils.Cfg)
}

func (a *App) PersistConfig() {
	utils.SaveConfig(a.ConfigFileName(), a.Config())
}

func (a *App) ReloadConfig() {
	debug.FreeOSMemory()
	utils.LoadGlobalConfig(a.ConfigFileName())

	// start/restart email batching job if necessary
	a.InitEmailBatching()
}

func (a *App) ConfigFileName() string {
	return utils.CfgFileName
}

func (a *App) ClientConfig() map[string]string {
	return a.clientConfig
}

func (a *App) ClientConfigHash() string {
	return a.clientConfigHash
}

func (a *App) EnableConfigWatch() {
	if a.configWatcher == nil && !a.disableConfigWatch {
		configWatcher, err := utils.NewConfigWatcher(utils.CfgFileName)
		if err != nil {
			l4g.Error(err)
		}
		a.configWatcher = configWatcher
	}
}

func (a *App) DisableConfigWatch() {
	if a.configWatcher != nil {
		a.configWatcher.Close()
		a.configWatcher = nil
	}
}

func (a *App) regenerateClientConfig() {
	a.clientConfig = utils.GenerateClientConfig(a.Config(), a.DiagnosticId())
	clientConfigJSON, _ := json.Marshal(a.clientConfig)
	a.clientConfigHash = fmt.Sprintf("%x", md5.Sum(clientConfigJSON))
}
