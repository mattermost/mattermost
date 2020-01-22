// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io"
	"os"
	"time"

	"runtime/debug"

	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/mailservice"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (a *App) GetLogs(page, perPage int) ([]string, *model.AppError) {
	var lines []string
	if a.Cluster != nil && *a.Config().ClusterSettings.Enable {
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

	if a.Cluster != nil && *a.Config().ClusterSettings.Enable {
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

	if *a.Config().LogSettings.EnableFile {
		logFile := utils.GetLogFileLocation(*a.Config().LogSettings.FileLocation)
		file, err := os.Open(logFile)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
		}

		defer file.Close()

		var newLine = []byte{'\n'}
		var lineCount int
		const searchPos = -1
		b := make([]byte, 1)
		var endOffset int64 = 0

		// if the file exists and it's last byte is '\n' - skip it
		var stat os.FileInfo
		if stat, err = os.Stat(logFile); err == nil {
			if _, err = file.ReadAt(b, stat.Size()-1); err == nil && b[0] == newLine[0] {
				endOffset = -1
			}
		}
		lineEndPos, err := file.Seek(endOffset, io.SeekEnd)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
		}
		for {
			pos, err := file.Seek(searchPos, io.SeekCurrent)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
			}

			_, err = file.ReadAt(b, pos)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
			}

			if b[0] == newLine[0] || pos == 0 {
				lineCount++
				if lineCount > page*perPage {
					line := make([]byte, lineEndPos-pos)
					_, err := file.ReadAt(line, pos)
					if err != nil {
						return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, err.Error(), http.StatusInternalServerError)
					}
					lines = append(lines, string(line))
				}
				if pos == 0 {
					break
				}
				lineEndPos = pos
			}

			if len(lines) == perPage {
				break
			}
		}

		for i, j := 0, len(lines)-1; i < j; i, j = i+1, j-1 {
			lines[i], lines[j] = lines[j], lines[i]
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
	mlog.Info("Purging all caches")
	a.Srv.sessionCache.Purge()
	a.Srv.statusCache.Purge()
	a.Srv.Store.Team().ClearCaches()
	a.Srv.Store.Channel().ClearCaches()
	a.Srv.Store.User().ClearCaches()
	a.Srv.Store.Post().ClearCaches()
	a.Srv.Store.FileInfo().ClearCaches()
	a.Srv.Store.Webhook().ClearCaches()
	a.LoadLicense()
}

func (a *App) RecycleDatabaseConnection() {
	oldStore := a.Srv.Store

	mlog.Warn("Attempting to recycle the database connection.")
	a.Srv.Store = a.Srv.newStore()
	a.Srv.Jobs.Store = a.Srv.Store

	if a.Srv.Store != oldStore {
		time.Sleep(20 * time.Second)
		oldStore.Close()
	}

	mlog.Warn("Finished recycling the database connection.")
}

func (a *App) TestSiteURL(siteURL string) *model.AppError {
	url := fmt.Sprintf("%s/api/v4/system/ping", siteURL)
	res, err := http.Get(url)
	if err != nil || res.StatusCode != 200 {
		return model.NewAppError("testSiteURL", "app.admin.test_site_url.failure", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (a *App) TestEmail(userId string, cfg *model.Config) *model.AppError {
	if len(*cfg.EmailSettings.SMTPServer) == 0 {
		return model.NewAppError("testEmail", "api.admin.test_email.missing_server", nil, utils.T("api.context.invalid_param.app_error", map[string]interface{}{"Name": "SMTPServer"}), http.StatusBadRequest)
	}

	if !*cfg.EmailSettings.SendEmailNotifications {
		return nil
	}

	// if the user hasn't changed their email settings, fill in the actual SMTP password so that
	// the user can verify an existing SMTP connection
	if *cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		if *cfg.EmailSettings.SMTPServer == *a.Config().EmailSettings.SMTPServer &&
			*cfg.EmailSettings.SMTPPort == *a.Config().EmailSettings.SMTPPort &&
			*cfg.EmailSettings.SMTPUsername == *a.Config().EmailSettings.SMTPUsername {
			*cfg.EmailSettings.SMTPPassword = *a.Config().EmailSettings.SMTPPassword
		} else {
			return model.NewAppError("testEmail", "api.admin.test_email.reenter_password", nil, "", http.StatusBadRequest)
		}
	}
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	T := utils.GetUserTranslations(user.Locale)
	license := a.License()
	if err := mailservice.SendMailUsingConfig(user.Email, T("api.admin.test_email.subject"), T("api.admin.test_email.body"), cfg, license != nil && *license.Features.Compliance); err != nil {
		return model.NewAppError("testEmail", "app.admin.test_email.failure", map[string]interface{}{"Error": err.Error()}, "", http.StatusInternalServerError)
	}

	return nil
}

// ServerBusyStateChanged is called when a CLUSTER_EVENT_BUSY_STATE_CHANGED is received.
func (a *App) ServerBusyStateChanged(sbs *model.ServerBusyState) {
	a.Srv.Busy.ClusterEventChanged(sbs)
	if sbs.Busy {
		mlog.Warn("server busy state activitated via cluster event - non-critical services disabled", mlog.Int64("expires_sec", sbs.Expires))
	} else {
		mlog.Info("server busy state cleared via cluster event - non-critical services enabled")
	}
}
