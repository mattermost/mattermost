// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"os"
	"strings"
	"time"

	"runtime/debug"

	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) GetLogs(page, perPage int) ([]string, *model.AppError) {

	perPage = 10000

	var lines []string
	if a.Cluster != nil && *utils.Cfg.ClusterSettings.Enable {
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, a.Cluster.GetMyClusterInfo().Hostname)
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
	}

	melines, err := a.GetLogsSkipSend(page, perPage)
	if err != nil {
		return nil, err
	}

	lines = append(lines, melines...)

	if a.Cluster != nil && *utils.Cfg.ClusterSettings.Enable {
		clines, err := a.Cluster.GetLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		lines = append(lines, clines...)
	}

	return lines, nil
}

func (a *App) GetLogsSkipSend(page, perPage int) ([]string, *model.AppError) {
	var lines []string

	if utils.Cfg.LogSettings.EnableFile {
		file, err := os.Open(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation))
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
		}

		defer file.Close()

		offsetCount := 0
		limitCount := 0
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			if limitCount >= perPage {
				break
			}

			if offsetCount >= page*perPage {
				lines = append(lines, scanner.Text())
				limitCount++
			} else {
				offsetCount++
			}
		}
	} else {
		lines = append(lines, "")
	}

	return lines, nil
}

func (a *App) GetClusterStatus() []*model.ClusterInfo {
	infos := make([]*model.ClusterInfo, 0)

	if a.Cluster != nil {
		infos = a.Cluster.GetClusterInfos()
	}

	return infos
}

func (a *App) InvalidateAllCaches() *model.AppError {
	debug.FreeOSMemory()
	a.InvalidateAllCachesSkipSend()

	if a.Cluster != nil {

		msg := &model.ClusterMessage{
			Event:            model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES,
			SendType:         model.CLUSTER_SEND_RELIABLE,
			WaitForAllToSend: true,
		}

		a.Cluster.SendClusterMessage(msg)
	}

	return nil
}

func (a *App) InvalidateAllCachesSkipSend() {
	l4g.Info(utils.T("api.context.invalidate_all_caches"))
	sessionCache.Purge()
	ClearStatusCache()
	sqlstore.ClearChannelCaches()
	sqlstore.ClearUserCaches()
	sqlstore.ClearPostCaches()
	sqlstore.ClearWebhookCaches()
	a.LoadLicense()
}

func (a *App) GetConfig() *model.Config {
	json := utils.Cfg.ToJson()
	cfg := model.ConfigFromJson(strings.NewReader(json))
	cfg.Sanitize()

	return cfg
}

func (a *App) ReloadConfig() {
	debug.FreeOSMemory()
	utils.LoadConfig(utils.CfgFileName)

	// start/restart email batching job if necessary
	a.InitEmailBatching()
}

func (a *App) SaveConfig(cfg *model.Config, sendConfigChangeClusterMessage bool) *model.AppError {
	oldCfg := utils.Cfg
	cfg.SetDefaults()
	utils.Desanitize(cfg)

	if err := cfg.IsValid(); err != nil {
		return err
	}

	if err := utils.ValidateLdapFilter(cfg, a.Ldap); err != nil {
		return err
	}

	if *utils.Cfg.ClusterSettings.Enable && *utils.Cfg.ClusterSettings.ReadOnlyConfig {
		return model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, "", http.StatusForbidden)
	}

	utils.DisableConfigWatch()
	utils.SaveConfig(utils.CfgFileName, cfg)
	utils.LoadConfig(utils.CfgFileName)
	utils.EnableConfigWatch()

	if a.Metrics != nil {
		if *utils.Cfg.MetricsSettings.Enable {
			a.Metrics.StartServer()
		} else {
			a.Metrics.StopServer()
		}
	}

	if a.Cluster != nil {
		err := a.Cluster.ConfigChanged(cfg, oldCfg, sendConfigChangeClusterMessage)
		if err != nil {
			return err
		}
	}

	// start/restart email batching job if necessary
	a.InitEmailBatching()

	return nil
}

func (a *App) RecycleDatabaseConnection() {
	oldStore := a.Srv.Store

	l4g.Warn(utils.T("api.admin.recycle_db_start.warn"))
	a.Srv.Store = store.NewLayeredStore(sqlstore.NewSqlSupplier(a.Metrics), a.Metrics, a.Cluster)

	a.Jobs.Store = a.Srv.Store

	time.Sleep(20 * time.Second)
	oldStore.Close()

	l4g.Warn(utils.T("api.admin.recycle_db_end.warn"))
}

func (a *App) TestEmail(userId string, cfg *model.Config) *model.AppError {
	if len(cfg.EmailSettings.SMTPServer) == 0 {
		return model.NewAppError("testEmail", "api.admin.test_email.missing_server", nil, utils.T("api.context.invalid_param.app_error", map[string]interface{}{"Name": "SMTPServer"}), http.StatusBadRequest)
	}

	// if the user hasn't changed their email settings, fill in the actual SMTP password so that
	// the user can verify an existing SMTP connection
	if cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		if cfg.EmailSettings.SMTPServer == utils.Cfg.EmailSettings.SMTPServer &&
			cfg.EmailSettings.SMTPPort == utils.Cfg.EmailSettings.SMTPPort &&
			cfg.EmailSettings.SMTPUsername == utils.Cfg.EmailSettings.SMTPUsername {
			cfg.EmailSettings.SMTPPassword = utils.Cfg.EmailSettings.SMTPPassword
		} else {
			return model.NewAppError("testEmail", "api.admin.test_email.reenter_password", nil, "", http.StatusBadRequest)
		}
	}
	if user, err := a.GetUser(userId); err != nil {
		return err
	} else {
		T := utils.GetUserTranslations(user.Locale)
		if err := utils.SendMailUsingConfig(user.Email, T("api.admin.test_email.subject"), T("api.admin.test_email.body"), cfg); err != nil {
			return err
		}
	}

	return nil
}
