// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime/debug"
	"time"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/cache"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

var latestVersionCache = cache.NewLRU(cache.LRUOptions{
	Size: 1,
})

func (s *Server) GetLogs(page, perPage int) ([]string, *model.AppError) {
	var lines []string

	license := s.License()
	if license != nil && *license.Features.Cluster && s.Cluster != nil && *s.platform.Config().ClusterSettings.Enable {
		if info := s.Cluster.GetMyClusterInfo(); info != nil {
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, info.Hostname)
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		} else {
			mlog.Error("Could not get cluster info")
		}
	}

	melines, err := s.GetLogsSkipSend(page, perPage, &model.LogFilter{})
	if err != nil {
		return nil, err
	}

	lines = append(lines, melines...)

	if s.Cluster != nil && *s.platform.Config().ClusterSettings.Enable {
		clines, err := s.Cluster.GetLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		lines = append(lines, clines...)
	}

	return lines, nil
}

func (s *Server) QueryLogs(page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	logData := make(map[string][]string)

	serverName := "default"

	license := s.License()
	if license != nil && *license.Features.Cluster && s.Cluster != nil && *s.platform.Config().ClusterSettings.Enable {
		if info := s.Cluster.GetMyClusterInfo(); info != nil {
			serverName = info.Hostname
		} else {
			mlog.Error("Could not get cluster info")
		}
	}

	serverNames := logFilter.ServerNames
	if len(serverNames) > 0 {
		for _, nodeName := range serverNames {
			if nodeName == "default" {
				AddLocalLogs(s, page, perPage, logData, nodeName, logFilter)
			}
		}
	} else {
		AddLocalLogs(s, page, perPage, logData, serverName, logFilter)
	}

	if s.Cluster != nil && *s.Config().ClusterSettings.Enable {
		clusterLogs, err := s.Cluster.QueryLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		if clusterLogs != nil {
			if len(serverNames) > 0 {
				for _, filteredNodeName := range serverNames {
					for nodeName, logs := range clusterLogs {
						if nodeName == filteredNodeName {
							logData[nodeName] = logs
						}
					}
				}
			} else {
				for nodeName, logs := range clusterLogs {
					logData[nodeName] = logs
				}
			}
		}
	}

	return logData, nil
}

func AddLocalLogs(s *Server, page, perPage int, logData map[string][]string, serverName string, logFilter *model.LogFilter) *model.AppError {
	currentServerLogs, err := s.GetLogsSkipSend(page, perPage, logFilter)
	if err != nil {
		return err
	}

	logData[serverName] = currentServerLogs
	return nil
}

func (a *App) QueryLogs(page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	return a.Srv().QueryLogs(page, perPage, logFilter)
}

func (a *App) GetLogs(page, perPage int) ([]string, *model.AppError) {
	return a.Srv().GetLogs(page, perPage)
}

func (s *Server) GetLogsSkipSend(page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	var lines []string

	if *s.platform.Config().LogSettings.EnableFile {
		s.Log.Flush()
		logFile := config.GetLogFileLocation(*s.platform.Config().LogSettings.FileLocation)
		file, err := os.Open(logFile)
		if err != nil {
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for {
			pos, err := file.Seek(searchPos, io.SeekCurrent)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			_, err = file.ReadAt(b, pos)
			if err != nil {
				return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if b[0] == newLine[0] || pos == 0 {
				lineCount++
				if lineCount > page*perPage {
					line := make([]byte, lineEndPos-pos)
					_, err := file.ReadAt(line, pos)
					if err != nil {
						return nil, model.NewAppError("getLogs", "api.admin.file_read_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}

					filtered := false
					var entry *model.LogEntry
					err = json.Unmarshal(line, &entry)
					if err != nil {
						mlog.Debug("Failed to parse line, skipping")
					} else {
						filtered = isLogFilteredByLevel(logFilter, entry) || filtered
						filtered = isLogFilteredByDate(logFilter, entry) || filtered
					}

					if filtered {
						lineCount--
					} else {
						lines = append(lines, string(line))
					}
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

func isLogFilteredByLevel(logFilter *model.LogFilter, entry *model.LogEntry) bool {
	logLevels := logFilter.LogLevels
	if len(logLevels) == 0 {
		return false
	}

	for _, level := range logLevels {
		if entry.Level == level {
			return false
		}
	}

	return true
}

func isLogFilteredByDate(logFilter *model.LogFilter, entry *model.LogEntry) bool {
	if logFilter.DateFrom == "" && logFilter.DateTo == "" {
		return false
	}

	dateFrom, err := time.Parse("2006-01-02 15:04:05.999 -07:00", logFilter.DateFrom)
	if err != nil {
		dateFrom = time.Time{}
	}
	dateTo, err := time.Parse("2006-01-02 15:04:05.999 -07:00", logFilter.DateTo)
	if err != nil {
		dateTo = time.Now()
	}

	timestamp, err := time.Parse("2006-01-02 15:04:05.999 -07:00", entry.Timestamp)
	if err != nil {
		mlog.Debug("Cannot parse timestamp, skipping")
		return false
	} else {
		if timestamp.Equal(dateFrom) || timestamp.Equal(dateTo) {
			return false
		}
		if timestamp.After(dateFrom) && timestamp.Before(dateTo) {
			return false
		}
	}

	return true
}

func (a *App) GetLogsSkipSend(page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	return a.Srv().GetLogsSkipSend(page, perPage, logFilter)
}

func (a *App) GetClusterStatus() []*model.ClusterInfo {
	infos := make([]*model.ClusterInfo, 0)

	if a.Cluster() != nil {
		infos = a.Cluster().GetClusterInfos()
	}

	return infos
}

func (s *Server) InvalidateAllCaches() *model.AppError {
	debug.FreeOSMemory()
	s.InvalidateAllCachesSkipSend()

	if s.Cluster != nil {

		msg := &model.ClusterMessage{
			Event:            model.ClusterEventInvalidateAllCaches,
			SendType:         model.ClusterSendReliable,
			WaitForAllToSend: true,
		}

		s.Cluster.SendClusterMessage(msg)
	}

	return nil
}

func (s *Server) InvalidateAllCachesSkipSend() {
	mlog.Info("Purging all caches")
	s.userService.ClearAllUsersSessionCacheLocal()
	s.statusCache.Purge()
	s.Store.Team().ClearCaches()
	s.Store.Channel().ClearCaches()
	s.Store.User().ClearCaches()
	s.Store.Post().ClearCaches()
	s.Store.FileInfo().ClearCaches()
	s.Store.Webhook().ClearCaches()
	linkCache.Purge()
	s.LoadLicense()
}

func (a *App) RecycleDatabaseConnection() {
	mlog.Info("Attempting to recycle database connections.")

	// This works by setting 10 seconds as the max conn lifetime for all DB connections.
	// This allows in gradually closing connections as they expire. In future, we can think
	// of exposing this as a param from the REST api.
	a.Srv().Store.RecycleDBConnections(10 * time.Second)

	mlog.Info("Finished recycling database connections.")
}

func (a *App) TestSiteURL(siteURL string) *model.AppError {
	url := fmt.Sprintf("%s/api/v4/system/ping", siteURL)
	res, err := http.Get(url)
	if err != nil || res.StatusCode != 200 {
		return model.NewAppError("testSiteURL", "app.admin.test_site_url.failure", nil, "", http.StatusBadRequest)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, res.Body)
		_ = res.Body.Close()
	}()

	return nil
}

func (a *App) TestEmail(userID string, cfg *model.Config) *model.AppError {
	if *cfg.EmailSettings.SMTPServer == "" {
		return model.NewAppError("testEmail", "api.admin.test_email.missing_server", nil, i18n.T("api.context.invalid_param.app_error", map[string]any{"Name": "SMTPServer"}), http.StatusBadRequest)
	}

	// if the user hasn't changed their email settings, fill in the actual SMTP password so that
	// the user can verify an existing SMTP connection
	if *cfg.EmailSettings.SMTPPassword == model.FakeSetting {
		if *cfg.EmailSettings.SMTPServer == *a.Config().EmailSettings.SMTPServer &&
			*cfg.EmailSettings.SMTPPort == *a.Config().EmailSettings.SMTPPort &&
			*cfg.EmailSettings.SMTPUsername == *a.Config().EmailSettings.SMTPUsername {
			*cfg.EmailSettings.SMTPPassword = *a.Config().EmailSettings.SMTPPassword
		} else {
			return model.NewAppError("testEmail", "api.admin.test_email.reenter_password", nil, "", http.StatusBadRequest)
		}
	}
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	T := i18n.GetUserTranslations(user.Locale)
	license := a.Srv().License()
	mailConfig := a.Srv().MailServiceConfig()
	if err := mail.SendMailUsingConfig(user.Email, T("api.admin.test_email.subject"), T("api.admin.test_email.body"), mailConfig, license != nil && *license.Features.Compliance, "", "", "", ""); err != nil {
		return model.NewAppError("testEmail", "app.admin.test_email.failure", map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError)
	}

	return nil
}

// serverBusyStateChanged is called when a CLUSTER_EVENT_BUSY_STATE_CHANGED is received.
func (s *Server) serverBusyStateChanged(sbs *model.ServerBusyState) {
	s.Busy.ClusterEventChanged(sbs)
	if sbs.Busy {
		mlog.Warn("server busy state activated via cluster event - non-critical services disabled", mlog.Int64("expires_sec", sbs.Expires))
	} else {
		mlog.Info("server busy state cleared via cluster event - non-critical services enabled")
	}
}

func (a *App) GetLatestVersion(latestVersionUrl string) (*model.GithubReleaseInfo, *model.AppError) {
	var cachedLatestVersion *model.GithubReleaseInfo
	if cacheErr := latestVersionCache.Get("latest_version_cache", &cachedLatestVersion); cacheErr == nil {
		return cachedLatestVersion, nil
	}

	res, err := http.Get(latestVersionUrl)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.latest_version_external_error.failure", nil, "", http.StatusInternalServerError)
	}

	defer res.Body.Close()

	responseData, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.latest_version_read_all.failure", nil, "", http.StatusInternalServerError)
	}

	var releaseInfoResponse *model.GithubReleaseInfo
	err = json.Unmarshal(responseData, &releaseInfoResponse)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.latest_version_unmarshal.failure", nil, "", http.StatusInternalServerError)
	}

	if validErr := releaseInfoResponse.IsValid(); validErr != nil {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.latest_version_external_error.failure", nil, "", http.StatusInternalServerError)
	}

	err = latestVersionCache.Set("latest_version_cache", releaseInfoResponse)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.latest_version_set_cache.failure", nil, "", http.StatusInternalServerError)
	}

	return releaseInfoResponse, nil
}

func (a *App) ClearLatestVersionCache() {
	latestVersionCache.Remove("latest_version_cache")
}
