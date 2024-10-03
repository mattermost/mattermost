// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SaveReportChunk(format string, prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	switch format {
	case "csv":
		return a.saveCSVChunk(prefix, count, reportData)
	}
	return model.NewAppError("SaveReportChunk", "app.save_report_chunk.unsupported_format", nil, "unsupported report format", http.StatusBadRequest)
}

func (a *App) saveCSVChunk(prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	for _, report := range reportData {
		err := w.Write(report.ToReport())
		if err != nil {
			return model.NewAppError("saveCSVChunk", "app.save_csv_chunk.write_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return model.NewAppError("saveCSVChunk", "app.save_csv_chunk.write_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, appErr := a.WriteFile(&buf, makeFilePath(prefix, count, "csv"))
	return appErr
}

func (a *App) CompileReportChunks(format string, prefix string, numberOfChunks int, headers []string) *model.AppError {
	switch format {
	case "csv":
		return a.compileCSVChunks(prefix, numberOfChunks, headers)
	}
	return model.NewAppError("CompileReportChunks", "app.compile_report_chunks.unsupported_format", nil, "", http.StatusBadRequest)
}

func (a *App) compileCSVChunks(prefix string, numberOfChunks int, headers []string) *model.AppError {
	filePath := makeCompiledFilePath(prefix, "csv")

	var compiledBuf bytes.Buffer
	w := csv.NewWriter(&compiledBuf)
	err := w.Write(headers)
	if err != nil {
		return model.NewAppError("compileCSVChunks", "app.compile_csv_chunks.header_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	w.Flush()
	if err = w.Error(); err != nil {
		return model.NewAppError("saveCSVChunk", "app.save_csv_chunk.write_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for i := 0; i < numberOfChunks; i++ {
		chunkFilePath := makeFilePath(prefix, i, "csv")
		chunk, err := a.ReadFile(chunkFilePath)
		if err != nil {
			return err
		}
		_, writeErr := compiledBuf.Write(chunk)
		if writeErr != nil {
			return err
		}
	}

	_, appErr := a.WriteFile(&compiledBuf, filePath)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) SendReportToUser(rctx request.CTX, job *model.Job, format string) *model.AppError {
	requestingUserId := job.Data["requesting_user_id"]
	if requestingUserId == "" {
		return model.NewAppError("SendReportToUser", "app.report.send_report_to_user.missing_user_id", nil, "", http.StatusInternalServerError)
	}
	dateRange := job.Data["date_range"]
	if dateRange == "" {
		return model.NewAppError("SendReportToUser", "app.report.send_report_to_user.missing_date_range", nil, "", http.StatusInternalServerError)
	}

	systemBot, err := a.GetSystemBot(rctx)
	if err != nil {
		return err
	}

	path := makeCompiledFilePath(job.Id, format)
	size, err := a.FileSize(path)
	if err != nil {
		return err
	}
	fileInfo, fileErr := a.Srv().Store().FileInfo().Save(rctx, &model.FileInfo{
		Name:      makeCompiledFilename(job.Id, format),
		Extension: format,
		Size:      size,
		Path:      path,
		CreatorId: systemBot.UserId,
	})
	if fileErr != nil {
		return model.NewAppError("SendReportToUser", "app.report.send_report_to_user.failed_to_save", nil, "", http.StatusInternalServerError).Wrap(fileErr)
	}

	channel, err := a.GetOrCreateDirectChannel(rctx, requestingUserId, systemBot.UserId)
	if err != nil {
		return err
	}

	user, err := a.GetUser(requestingUserId)
	if err != nil {
		return err
	}
	T := i18n.GetUserTranslations(user.Locale)
	post := &model.Post{
		ChannelId: channel.Id,
		Message: T("app.report.send_report_to_user.export_finished", map[string]string{
			"DateRange": getTranslatedDateRange(dateRange),
		}),
		Type:    model.PostTypeDefault,
		UserId:  systemBot.UserId,
		FileIds: []string{fileInfo.Id},
	}

	_, err = a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true})
	return err
}

func (a *App) CleanupReportChunks(format string, prefix string, numberOfChunks int) *model.AppError {
	switch format {
	case "csv":
		return a.cleanupCSVChunks(prefix, numberOfChunks)
	}
	return model.NewAppError("CompileReportChunks", "app.compile_report_chunks.unsupported_format", nil, "", http.StatusBadRequest)
}

func (a *App) cleanupCSVChunks(prefix string, numberOfChunks int) *model.AppError {
	for i := 0; i < numberOfChunks; i++ {
		chunkFilePath := makeFilePath(prefix, i, "csv")
		if err := a.RemoveFile(chunkFilePath); err != nil {
			return err
		}
	}

	return nil
}

func makeFilePath(prefix string, count int, extension string) string {
	return fmt.Sprintf("admin_reports/batch_report_%s__%d.%s", prefix, count, extension)
}

func makeCompiledFilePath(prefix string, extension string) string {
	return fmt.Sprintf("admin_reports/%s", makeCompiledFilename(prefix, extension))
}

func makeCompiledFilename(prefix string, extension string) string {
	return fmt.Sprintf("batch_report_%s.%s", prefix, extension)
}

func (a *App) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	if appErr := filter.IsValid(); appErr != nil {
		return nil, appErr
	}

	userReportQuery, err := a.Srv().Store().User().GetUserReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetUsersForReporting", "app.report.get_user_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userReports := make([]*model.UserReport, len(userReportQuery))
	for i, user := range userReportQuery {
		userReports[i] = user.ToReport()
	}

	return userReports, nil
}

func (a *App) GetUserCountForReport(filter *model.UserReportOptions) (*int64, *model.AppError) {
	count, err := a.Srv().Store().User().GetUserCountForReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetUserCountForReport", "app.report.get_user_count_for_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &count, nil
}

func (a *App) StartUsersBatchExport(rctx request.CTX, ro *model.UserReportOptions, startAt int64, endAt int64) *model.AppError {
	if license := a.Srv().License(); license == nil || (license.SkuShortName != model.LicenseShortSkuProfessional && license.SkuShortName != model.LicenseShortSkuEnterprise) {
		return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.license_error", nil, "", http.StatusBadRequest)
	}

	options := map[string]string{
		"requesting_user_id": rctx.Session().UserId,
		"date_range":         ro.DateRange,
		"role":               ro.Role,
		"team":               ro.Team,
		"hide_active":        strconv.FormatBool(ro.HideActive),
		"hide_inactive":      strconv.FormatBool(ro.HideInactive),
		"start_at":           strconv.FormatInt(startAt, 10),
		"end_at":             strconv.FormatInt(endAt, 10),
	}

	// Check for existing jobs
	if err := a.checkForExistingJobs(rctx, options, model.JobTypeExportUsersToCSV); err != nil {
		return err
	}

	_, err := a.Srv().Jobs.CreateJob(rctx, model.JobTypeExportUsersToCSV, options)
	if err != nil {
		return err
	}

	a.Srv().Go(func() {
		systemBot, err := a.GetSystemBot(rctx)
		if err != nil {
			rctx.Logger().Error("Failed to get the system bot", mlog.Err(err))
			return
		}

		channel, err := a.GetOrCreateDirectChannel(rctx, rctx.Session().UserId, systemBot.UserId)
		if err != nil {
			rctx.Logger().Error("Failed to get or create the DM", mlog.Err(err))
			return
		}

		user, err := a.GetUser(rctx.Session().UserId)
		if err != nil {
			rctx.Logger().Error("Failed to get the user", mlog.Err(err))
			return
		}
		T := i18n.GetUserTranslations(user.Locale)
		post := &model.Post{
			ChannelId: channel.Id,
			Message:   T("app.report.start_users_batch_export.started_export", map[string]string{"DateRange": getTranslatedDateRange(ro.DateRange)}),
			Type:      model.PostTypeDefault,
			UserId:    systemBot.UserId,
		}

		if _, err := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); err != nil {
			rctx.Logger().Error("Failed to post batch export message", mlog.Err(err))
		}
	})

	return nil
}

// Helper function to check for existing or pending jobs
func (a *App) checkForExistingJobs(rctx request.CTX, options map[string]string, jobType string) *model.AppError {
	checkJobExists := func(jobs []*model.Job, options map[string]string) bool {
		for _, job := range jobs {
			if job.Data["date_range"] == options["date_range"] &&
				job.Data["requesting_user_id"] == options["requesting_user_id"] &&
				job.Data["role"] == options["role"] &&
				job.Data["team"] == options["team"] &&
				job.Data["hide_active"] == options["hide_active"] &&
				job.Data["hide_inactive"] == options["hide_inactive"] {
				return true
			}
		}
		return false
	}

	pendingJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, jobType, model.JobStatusPending)
	if err != nil {
		return err
	}
	if checkJobExists(pendingJobs, options) {
		return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
	}

	inProgressJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, jobType, model.JobStatusInProgress)
	if err != nil {
		return err
	}
	if checkJobExists(inProgressJobs, options) {
		return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
	}

	return nil
}

func getTranslatedDateRange(dateRange string) string {
	switch dateRange {
	case model.ReportDurationLast30Days:
		return i18n.T("app.report.date_range.last_30_days")
	case model.ReportDurationPreviousMonth:
		return i18n.T("app.report.date_range.previous_month")
	case model.ReportDurationLast6Months:
		return i18n.T("app.report.date_range.last_6_months")
	default:
		return i18n.T("app.report.date_range.all_time")
	}
}
