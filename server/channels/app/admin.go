// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

var latestVersionCache = cache.NewLRU(cache.LRUOptions{
	Size: 1,
})

func (s *Server) GetLogs(c request.CTX, page, perPage int) ([]string, *model.AppError) {
	var lines []string

	license := s.License()
	if license != nil && *license.Features.Cluster && s.platform.Cluster() != nil && *s.platform.Config().ClusterSettings.Enable {
		if info := s.platform.Cluster().GetMyClusterInfo(); info != nil {
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, info.Hostname)
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
			lines = append(lines, "-----------------------------------------------------------------------------------------------------------")
		} else {
			c.Logger().Error("Could not get cluster info")
		}
	}

	melines, err := s.GetLogsSkipSend(page, perPage, &model.LogFilter{})
	if err != nil {
		return nil, err
	}

	lines = append(lines, melines...)

	if s.platform.Cluster() != nil && *s.platform.Config().ClusterSettings.Enable {
		clines, err := s.platform.Cluster().GetLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		lines = append(lines, clines...)
	}

	return lines, nil
}

func (s *Server) QueryLogs(c request.CTX, page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	logData := make(map[string][]string)

	serverName := "default"

	license := s.License()
	if license != nil && *license.Features.Cluster && s.platform.Cluster() != nil && *s.platform.Config().ClusterSettings.Enable {
		if info := s.platform.Cluster().GetMyClusterInfo(); info != nil {
			serverName = info.Hostname
		} else {
			c.Logger().Error("Could not get cluster info")
		}
	}

	serverNames := logFilter.ServerNames
	if len(serverNames) > 0 {
		for _, nodeName := range serverNames {
			if nodeName == "default" {
				AddLocalLogs(logData, s, page, perPage, nodeName, logFilter)
			}
		}
	} else {
		AddLocalLogs(logData, s, page, perPage, serverName, logFilter)
	}

	if s.platform.Cluster() != nil && *s.Config().ClusterSettings.Enable {
		clusterLogs, err := s.platform.Cluster().QueryLogs(page, perPage)
		if err != nil {
			return nil, err
		}

		if clusterLogs != nil && len(serverNames) > 0 {
			for _, filteredNodeName := range serverNames {
				logData[filteredNodeName] = clusterLogs[filteredNodeName]
			}
		} else {
			for nodeName, logs := range clusterLogs {
				logData[nodeName] = logs
			}
		}
	}

	return logData, nil
}

func AddLocalLogs(logData map[string][]string, s *Server, page, perPage int, serverName string, logFilter *model.LogFilter) *model.AppError {
	currentServerLogs, err := s.GetLogsSkipSend(page, perPage, logFilter)
	if err != nil {
		return err
	}

	logData[serverName] = currentServerLogs
	return nil
}

func (a *App) QueryLogs(c request.CTX, page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	return a.Srv().QueryLogs(c, page, perPage, logFilter)
}

func (a *App) GetLogs(c request.CTX, page, perPage int) ([]string, *model.AppError) {
	return a.Srv().GetLogs(c, page, perPage)
}

func (s *Server) GetLogsSkipSend(page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	return s.platform.GetLogsSkipSend(page, perPage, logFilter)
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

func (s *Server) InvalidateAllCaches() {
	s.platform.InvalidateAllCaches()
}

func (s *Server) InvalidateAllCachesSkipSend() {
	s.platform.InvalidateAllCachesSkipSend()

}

func (a *App) RecycleDatabaseConnection(c request.CTX) {
	c.Logger().Info("Attempting to recycle database connections.")

	// This works by setting 10 seconds as the max conn lifetime for all DB connections.
	// This allows in gradually closing connections as they expire. In future, we can think
	// of exposing this as a param from the REST api.
	a.Srv().Store().RecycleDBConnections(10 * time.Second)

	c.Logger().Info("Finished recycling database connections.")
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
	if err := mail.SendMailUsingConfig(user.Email, T("api.admin.test_email.subject"), T("api.admin.test_email.body"), mailConfig, license != nil && *license.Features.Compliance, "", "", "", "", ""); err != nil {
		return model.NewAppError("testEmail", "app.admin.test_email.failure", map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) GetLatestVersion(latestVersionUrl string) (*model.GithubReleaseInfo, *model.AppError) {
	var cachedLatestVersion *model.GithubReleaseInfo
	if cacheErr := latestVersionCache.Get("latest_version_cache", &cachedLatestVersion); cacheErr == nil {
		return cachedLatestVersion, nil
	}

	res, err := http.Get(latestVersionUrl)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	defer res.Body.Close()

	responseData, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var releaseInfoResponse *model.GithubReleaseInfo
	err = json.Unmarshal(responseData, &releaseInfoResponse)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if validErr := releaseInfoResponse.IsValid(); validErr != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(validErr)
	}

	err = latestVersionCache.Set("latest_version_cache", releaseInfoResponse)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return releaseInfoResponse, nil
}

func (a *App) ClearLatestVersionCache() {
	latestVersionCache.Remove("latest_version_cache")
}
