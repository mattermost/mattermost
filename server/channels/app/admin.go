// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

var latestVersionCache = cache.NewLRU(&cache.CacheOptions{
	Size: 1,
})

// LatestVersionURL is the GitHub endpoint for the latest server release.
const LatestVersionURL = "https://api.github.com/repos/mattermost/mattermost-server/releases/latest"

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

	s.requeryNodesNamedBySearch(rctx, page, perPage, logFilter, localName, clusterLogs, logData)

	return logData, nil
}

// requeryNodesNamedBySearch replaces the searched entries of a node whose name holds the search
// term with its unsearched ones. Once the System Console lists more than one node, a search also
// matches node names, which aren't in the log lines, so every entry of such a node is a match.
// Remote names are only known from the first response, hence the second query. If it fails, the
// searched entries are kept.
func (s *Server) requeryNodesNamedBySearch(rctx request.CTX, page, perPage int, logFilter *model.LogFilter, localName string, clusterLogs map[string]einterfaces.NodeLogs, logData map[string][]string) {
	if logFilter.Search == "" || len(logData) < 2 {
		return
	}

	unsearched := *logFilter
	unsearched.Search = ""
	unsearched.ServerNames = nil
	lowerSearch := strings.ToLower(logFilter.Search)
	for name := range logData {
		if !strings.Contains(strings.ToLower(name), lowerSearch) || clusterLogs[name].Err != nil {
			continue
		}
		if name != localName {
			unsearched.ServerNames = append(unsearched.ServerNames, name)
			continue
		}
		if lines, appErr := s.GetLogsSkipSend(rctx, page, perPage, &unsearched); appErr != nil {
			rctx.Logger().Warn("Failed to get the unsearched logs of the node named by the search", mlog.Err(appErr))
		} else {
			logData[name] = lines
		}
	}

	if len(unsearched.ServerNames) == 0 {
		return
	}
	nodeLogs, appErr := s.platform.Cluster().QueryLogs(rctx, page, perPage, &unsearched)
	if appErr != nil {
		rctx.Logger().Warn("Failed to get the unsearched logs of the nodes named by the search", mlog.Err(appErr))
		return
	}
	for _, name := range unsearched.ServerNames {
		if logs, ok := nodeLogs[name]; ok && logs.Err == nil {
			logData[name] = logs.Lines
		}
	}
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
	return s.platform.InvalidateAllCaches()
}

func (s *Server) InvalidateAllCachesSkipSend() *model.AppError {
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

func (a *App) GetLatestVersion(rctx request.CTX, latestVersionUrl string) (*model.GithubReleaseInfo, *model.AppError) {
	var cachedLatestVersion *model.GithubReleaseInfo
	if cacheErr := latestVersionCache.Get("latest_version_cache", &cachedLatestVersion); cacheErr == nil {
		return cachedLatestVersion, nil
	}

	req, err := http.NewRequestWithContext(rctx.Context(), http.MethodGet, latestVersionUrl, nil)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
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

	err = latestVersionCache.SetWithExpiry("latest_version_cache", releaseInfoResponse, 24*time.Hour)
	if err != nil {
		return nil, model.NewAppError("GetLatestVersion", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return releaseInfoResponse, nil
}

func (a *App) clearLatestVersionCache() error {
	return latestVersionCache.Remove("latest_version_cache")
}
