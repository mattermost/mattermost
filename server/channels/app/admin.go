// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"io"
	"maps"
	"net/http"
	"slices"
	"time"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

var latestVersionCache = cache.NewLRU(&cache.CacheOptions{
	Size: 2,
})

const (
	latestVersionCacheKey        = "latest_version_cache"
	latestVersionFailureCacheKey = "latest_version_failure_cache"
	// latestVersionFailureExpiry spaces out retries from servers that cannot reach GitHub, which
	// also keeps servers behind a shared IP under its unauthenticated rate limit.
	latestVersionFailureExpiry = 6 * time.Hour
)

// testSiteURLTimeout matches how long the webapp waits for the Site URL test before giving up.
var testSiteURLTimeout = 10 * time.Second

func (s *Server) GetLogs(rctx request.CTX, page, perPage int) ([]string, *model.AppError) {
	var lines []string

	cluster := s.platform.Cluster()
	license := s.License()
	clustered := license != nil && *license.Features.Cluster && cluster != nil && *s.platform.Config().ClusterSettings.Enable

	if clustered {
		localName := "default"
		if info := cluster.GetMyClusterInfo(); info != nil {
			localName = info.Hostname
		} else {
			rctx.Logger().Error("Could not get cluster info")
		}
		lines = appendNodeSeparator(lines, localName)
	}

	melines, err := s.GetLogsSkipSend(rctx, page, perPage, &model.LogFilter{})
	if err != nil {
		return nil, err
	}

	lines = append(lines, melines...)

	if !clustered {
		return lines, nil
	}

	clusterLogs, appErr := cluster.QueryLogs(rctx, page, perPage, &model.LogFilter{})
	if appErr != nil {
		return nil, appErr
	}
	for _, name := range slices.Sorted(maps.Keys(clusterLogs)) {
		lines = append(lines, "", "")
		lines = appendNodeSeparator(lines, name)
		if nodeLogs := clusterLogs[name]; nodeLogs.Err != nil {
			lines = append(lines, failedNodeLogLine(nodeLogs.Err))
		} else {
			lines = append(lines, nodeLogs.Lines...)
		}
	}

	return lines, nil
}

// appendNodeSeparator appends the banner that precedes a node's lines in the plain-text logs.
func appendNodeSeparator(lines []string, name string) []string {
	const rule = "-----------------------------------------------------------------------------------------------------------"
	return append(lines, rule, rule, name, rule, rule)
}

func (s *Server) QueryLogs(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	cluster := s.platform.Cluster()
	license := s.License()
	clustered := license != nil && *license.Features.Cluster && cluster != nil && *s.platform.Config().ClusterSettings.Enable

	localName := "default"
	if clustered {
		if info := cluster.GetMyClusterInfo(); info != nil {
			localName = info.Hostname
		} else {
			rctx.Logger().Error("Could not get cluster info")
		}
	}

	// "default" stays an alias for the local node so pre-cluster-aware clients keep working.
	wantLocal := len(logFilter.ServerNames) == 0
	var remoteNames []string
	for _, name := range logFilter.ServerNames {
		if name == localName || name == "default" {
			wantLocal = true
		} else {
			remoteNames = append(remoteNames, name)
		}
	}

	logData := make(map[string][]string)
	if wantLocal {
		localLogs, appErr := s.GetLogsSkipSend(rctx, page, perPage, logFilter)
		if appErr != nil {
			return nil, appErr
		}
		logData[localName] = localLogs
	}

	wantRemote := len(logFilter.ServerNames) == 0 || len(remoteNames) > 0
	if !clustered || !wantRemote {
		return logData, nil
	}

	clusterLogs, appErr := cluster.QueryLogs(rctx, page, perPage, logFilter)
	if appErr != nil {
		return nil, appErr
	}
	for name, nodeLogs := range clusterLogs {
		if len(logFilter.ServerNames) > 0 && !slices.Contains(remoteNames, name) {
			continue
		}
		if nodeLogs.Err != nil {
			logData[name] = []string{failedNodeLogLine(nodeLogs.Err)}
		} else {
			logData[name] = nodeLogs.Lines
		}
	}

	return logData, nil
}

// failedNodeLogLine returns an mlog-style JSON log line reporting that a node's logs could not be fetched.
// failed_node marks it so clients can tell it apart from lines the node logged itself.
func failedNodeLogLine(appErr *model.AppError) string {
	return string(model.ToJSON(struct {
		Timestamp  string `json:"timestamp"`
		Level      string `json:"level"`
		Msg        string `json:"msg"`
		Error      string `json:"error"`
		FailedNode bool   `json:"failed_node"`
	}{
		Timestamp:  time.Now().Format(logr.DefTimestampFormat),
		Level:      mlog.LvlError.Name,
		Msg:        "Failed to fetch logs from node",
		Error:      appErr.Error(),
		FailedNode: true,
	}))
}

func (a *App) QueryLogs(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) (map[string][]string, *model.AppError) {
	return a.Srv().QueryLogs(rctx, page, perPage, logFilter)
}

func (a *App) GetLogs(rctx request.CTX, page, perPage int) ([]string, *model.AppError) {
	return a.Srv().GetLogs(rctx, page, perPage)
}

func (s *Server) GetLogsSkipSend(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	return s.platform.GetLogsSkipSend(rctx, page, perPage, logFilter)
}

func (a *App) GetLogsSkipSend(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) ([]string, *model.AppError) {
	return a.Srv().GetLogsSkipSend(rctx, page, perPage, logFilter)
}

func (a *App) GetClusterStatus(rctx request.CTX) ([]*model.ClusterInfo, error) {
	if a.Cluster() == nil {
		return make([]*model.ClusterInfo, 0), nil
	}
	return a.Cluster().GetClusterInfos()
}

func (s *Server) InvalidateAllCaches() *model.AppError {
	if s.ch != nil {
		s.ch.invalidateSystemSettingPolicyCache()
	}
	return s.platform.InvalidateAllCaches()
}

func (s *Server) InvalidateAllCachesSkipSend() *model.AppError {
	if s.ch != nil && s.ch.systemSettingPoliciesCache != nil {
		s.ch.systemSettingPoliciesCache.Invalidate()
	}
	return s.platform.InvalidateAllCachesSkipSend()
}

func (a *App) RecycleDatabaseConnection(rctx request.CTX) {
	rctx.Logger().Info("Attempting to recycle database connections.")

	// This works by setting 10 seconds as the max conn lifetime for all DB connections.
	// This allows in gradually closing connections as they expire. In future, we can think
	// of exposing this as a param from the REST api.
	a.Srv().Store().RecycleDBConnections(10 * time.Second)

	rctx.Logger().Info("Finished recycling database connections.")
}

func (a *App) TestSiteURL(rctx request.CTX, siteURL string) *model.AppError {
	url := fmt.Sprintf("%s/api/v4/system/ping", siteURL)
	client := &http.Client{Timeout: testSiteURLTimeout}
	res, err := client.Get(url)
	if err != nil {
		return model.NewAppError("testSiteURL", "app.admin.test_site_url.failure", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// A non-200 body is closed without draining so a stalled body can't delay the error until the timeout.
	if res.StatusCode != http.StatusOK {
		_ = res.Body.Close()
		return model.NewAppError("testSiteURL", "app.admin.test_site_url.failure", nil, fmt.Sprintf("status_code=%d", res.StatusCode), http.StatusBadRequest)
	}

	_, _ = io.Copy(io.Discard, res.Body)
	_ = res.Body.Close()

	return nil
}

func (a *App) TestEmail(rctx request.CTX, userID string, cfg *model.Config) *model.AppError {
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
	user, err := a.GetUser(rctx, userID)
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

// GetLatestVersion fetches the latest release from latestVersionUrl. It makes no request while
// ServiceSettings.EnableSecurityFixAlert is off, the setting that stops the server contacting
// external services for update information.
func (a *App) GetLatestVersion(rctx request.CTX, latestVersionUrl string) (*model.GithubReleaseInfo, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableSecurityFixAlert {
		return nil, model.NewAppError("GetLatestVersion", "app.admin.get_latest_version.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	var cachedLatestVersion *model.GithubReleaseInfo
	if cacheErr := latestVersionCache.Get(latestVersionCacheKey, &cachedLatestVersion); cacheErr == nil {
		return cachedLatestVersion, nil
	}

	var cachedFailure string
	if cacheErr := latestVersionCache.Get(latestVersionFailureCacheKey, &cachedFailure); cacheErr == nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, cachedFailure, http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(rctx.Context(), 10*time.Second)
	defer cancel()
	releaseInfoResponse, err := releases.FetchLatest(ctx, latestVersionUrl)
	if err != nil {
		// A cancelled request says nothing about whether the feed is reachable.
		if rctx.Context().Err() == nil {
			if cacheErr := latestVersionCache.SetWithExpiry(latestVersionFailureCacheKey, err.Error(), latestVersionFailureExpiry); cacheErr != nil {
				rctx.Logger().Warn("Failed to cache the latest version failure", mlog.Err(cacheErr))
			}
		}
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err = latestVersionCache.SetWithExpiry(latestVersionCacheKey, releaseInfoResponse, 24*time.Hour)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return releaseInfoResponse, nil
}

func (a *App) clearLatestVersionCache() error {
	return latestVersionCache.Purge()
}

// clearLatestVersionCacheOnFlip drops a cached release or failure when EnableSecurityFixAlert is
// toggled, so an admin who fixed the server's network access can retry by toggling it.
func (ch *Channels) clearLatestVersionCacheOnFlip(prevCfg, cfg *model.Config) {
	if *prevCfg.ServiceSettings.EnableSecurityFixAlert == *cfg.ServiceSettings.EnableSecurityFixAlert {
		return
	}

	if err := latestVersionCache.Purge(); err != nil {
		ch.srv.Log().Warn("Failed to clear the latest version cache", mlog.Err(err))
	}
}
