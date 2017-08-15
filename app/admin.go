// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"os"
	"strings"
	"time"

	"runtime/debug"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/jobs"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func GetLogs(page, perPage int) ([]string, *model.AppError) {

	perPage = 10000

	var lines []string
	if einterfaces.GetClusterInterface() != nil && *utils.Cfg.ClusterSettings.Enable {
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, einterfaces.GetClusterInterface().GetClusterId())
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
	}

	melines, err := GetLogsSkipSend(page, perPage)
	if err != nil {
		return nil, err
	}

	lines = append(lines, melines...)

	if einterfaces.GetClusterInterface() != nil && *utils.Cfg.ClusterSettings.Enable {
		clines, err := einterfaces.GetClusterInterface().GetLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		lines = append(lines, clines...)
	}

	return lines, nil
}

func GetLogsSkipSend(page, perPage int) ([]string, *model.AppError) {
	var lines []string

	if utils.Cfg.LogSettings.EnableFile {
		file, err := os.Open(utils.GetLogFileLocation(utils.Cfg.LogSettings.FileLocation))
		if err != nil {
			return nil, model.NewLocAppError("getLogs", "api.admin.file_read_error", nil, err.Error())
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

func GetClusterStatus() []*model.ClusterInfo {
	infos := make([]*model.ClusterInfo, 0)

	if einterfaces.GetClusterInterface() != nil {
		infos = einterfaces.GetClusterInterface().GetClusterInfos()
	}

	return infos
}

func InvalidateAllCaches() *model.AppError {
	debug.FreeOSMemory()
	InvalidateAllCachesSkipSend()

	if einterfaces.GetClusterInterface() != nil {

		msg := &model.ClusterMessage{
			Event:            model.CLUSTER_EVENT_INVALIDATE_ALL_CACHES,
			SendType:         model.CLUSTER_SEND_RELIABLE,
			WaitForAllToSend: true,
		}

		einterfaces.GetClusterInterface().SendClusterMessage(msg)
	}

	return nil
}

func InvalidateAllCachesSkipSend() {
	l4g.Info(utils.T("api.context.invalidate_all_caches"))
	sessionCache.Purge()
	ClearStatusCache()
	store.ClearChannelCaches()
	store.ClearUserCaches()
	store.ClearPostCaches()
	store.ClearWebhookCaches()
	LoadLicense()
}

func GetConfig() *model.Config {
	json := utils.Cfg.ToJson()
	cfg := model.ConfigFromJson(strings.NewReader(json))
	cfg.Sanitize()

	return cfg
}

func ReloadConfig() {
	debug.FreeOSMemory()
	utils.LoadConfig(utils.CfgFileName)

	// start/restart email batching job if necessary
	InitEmailBatching()
}

func SaveConfig(cfg *model.Config, sendConfigChangeClusterMessage bool) *model.AppError {
	oldCfg := utils.Cfg
	cfg.SetDefaults()
	utils.Desanitize(cfg)

	if err := cfg.IsValid(); err != nil {
		return err
	}

	if err := utils.ValidateLdapFilter(cfg); err != nil {
		return err
	}

	if *utils.Cfg.ClusterSettings.Enable && *utils.Cfg.ClusterSettings.ReadOnlyConfig {
		return model.NewLocAppError("saveConfig", "ent.cluster.save_config.error", nil, "")
	}

	utils.DisableConfigWatch()
	utils.SaveConfig(utils.CfgFileName, cfg)
	utils.LoadConfig(utils.CfgFileName)
	utils.EnableConfigWatch()

	if einterfaces.GetMetricsInterface() != nil {
		if *utils.Cfg.MetricsSettings.Enable {
			einterfaces.GetMetricsInterface().StartServer()
		} else {
			einterfaces.GetMetricsInterface().StopServer()
		}
	}

	if einterfaces.GetClusterInterface() != nil {
		err := einterfaces.GetClusterInterface().ConfigChanged(cfg, oldCfg, sendConfigChangeClusterMessage)
		if err != nil {
			return err
		}
	}

	// start/restart email batching job if necessary
	InitEmailBatching()

	return nil
}

func RecycleDatabaseConnection() {
	oldStore := Srv.Store

	l4g.Warn(utils.T("api.admin.recycle_db_start.warn"))
	Srv.Store = store.NewLayeredStore()

	jobs.Srv.Store = Srv.Store

	time.Sleep(20 * time.Second)
	oldStore.Close()

	l4g.Warn(utils.T("api.admin.recycle_db_end.warn"))
}

func TestEmail(userId string, cfg *model.Config) *model.AppError {
	if len(cfg.EmailSettings.SMTPServer) == 0 {
		return model.NewLocAppError("testEmail", "api.admin.test_email.missing_server", nil, utils.T("api.context.invalid_param.app_error", map[string]interface{}{"Name": "SMTPServer"}))
	}

	// if the user hasn't changed their email settings, fill in the actual SMTP password so that
	// the user can verify an existing SMTP connection
	if cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		if cfg.EmailSettings.SMTPServer == utils.Cfg.EmailSettings.SMTPServer &&
			cfg.EmailSettings.SMTPPort == utils.Cfg.EmailSettings.SMTPPort &&
			cfg.EmailSettings.SMTPUsername == utils.Cfg.EmailSettings.SMTPUsername {
			cfg.EmailSettings.SMTPPassword = utils.Cfg.EmailSettings.SMTPPassword
		} else {
			return model.NewLocAppError("testEmail", "api.admin.test_email.reenter_password", nil, "")
		}
	}

	if user, err := GetUser(userId); err != nil {
		return err
	} else {
		T := utils.GetUserTranslations(user.Locale)
		if err := utils.SendMailUsingConfig(user.Email, T("api.admin.test_email.subject"), T("api.admin.test_email.body"), cfg); err != nil {
			return err
		}
	}

	return nil
}
