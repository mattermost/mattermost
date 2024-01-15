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
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
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

	var headerBuf bytes.Buffer
	w := csv.NewWriter(&headerBuf)
	err := w.Write(headers)
	if err != nil {
		return model.NewAppError("compileCSVChunks", "app.compile_csv_chunks.header_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	w.Flush()
	if err = w.Error(); err != nil {
		return model.NewAppError("saveCSVChunk", "app.save_csv_chunk.write_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, appErr := a.WriteFile(&headerBuf, filePath)
	if appErr != nil {
		return appErr
	}

	for i := 0; i < numberOfChunks; i++ {
		chunkFilePath := makeFilePath(prefix, i, "csv")
		chunk, err := a.ReadFile(chunkFilePath)
		if err != nil {
			return err
		}
		if _, err = a.AppendFile(bytes.NewReader(chunk), filePath); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) SendReportToUser(rctx request.CTX, userID string, jobId string, format string) *model.AppError {
	systemBot, err := a.GetSystemBot()
	if err != nil {
		return err
	}

	channel, err := a.GetOrCreateDirectChannel(request.EmptyContext(a.Log()), userID, systemBot.UserId)
	if err != nil {
		return err
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   i18n.T("app.report.send_report_to_user.export_finished", map[string]string{"Link": a.GetSiteURL() + "/api/v4/reports/export/" + jobId + "?format=" + format}),
		Type:      model.PostTypeAdminReport,
		UserId:    systemBot.UserId,
		Props: model.StringInterface{
			"reportId": jobId,
			"format":   format,
		},
	}

	_, err = a.CreatePost(rctx, post, channel, false, true)
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

func (a *App) StartUsersBatchExport(rctx request.CTX, startAt int64, endAt int64) *model.AppError {
	options := map[string]string{
		"requesting_user_id": rctx.Session().UserId,
		"start_at":           strconv.FormatInt(startAt, 10),
		"end_at":             strconv.FormatInt(endAt, 10),
	}

	// Check for existing job
	// TODO: Maybe make this a reusable function?
	pendingJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, model.JobTypeExportUsersToCSV, model.JobStatusPending)
	if err != nil {
		return err
	}
	for _, job := range pendingJobs {
		if job.Data["start_at"] == options["start_at"] && job.Data["end_at"] == options["end_at"] && job.Data["requesting_user_id"] == rctx.Session().UserId {
			return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
		}
	}

	inProgressJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, model.JobTypeExportUsersToCSV, model.JobStatusInProgress)
	if err != nil {
		return err
	}
	for _, job := range inProgressJobs {
		if job.Data["start_at"] == options["start_at"] && job.Data["end_at"] == options["end_at"] && job.Data["requesting_user_id"] == rctx.Session().UserId {
			return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
		}
	}

	_, err = a.Srv().Jobs.CreateJobOnce(rctx, model.JobTypeExportUsersToCSV, options)
	if err != nil {
		return err
	}

	a.Srv().Go(func() {
		systemBot, err := a.GetSystemBot()
		if err != nil {
			rctx.Logger().Error("Failed to get the system bot", mlog.Err(err))
			return
		}

		channel, err := a.GetOrCreateDirectChannel(request.EmptyContext(a.Log()), rctx.Session().UserId, systemBot.UserId)
		if err != nil {
			rctx.Logger().Error("Failed to get or create the DM", mlog.Err(err))
			return
		}

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   i18n.T("app.report.start_users_batch_export.started_export"),
			Type:      model.PostTypeDefault,
			UserId:    systemBot.UserId,
		}

		if _, err := a.CreatePost(rctx, post, channel, false, true); err != nil {
			rctx.Logger().Error("Failed to post batch export message", mlog.Err(err))
		}
	})

	return nil
}

func (a *App) RetrieveBatchReport(reportID string, format string) (filestore.ReadCloseSeeker, string, *model.AppError) {
	filePath := makeCompiledFilePath(reportID, format)
	reader, err := a.FileReader(filePath)
	if err != nil {
		return nil, "", err
	}

	return reader, makeCompiledFilename(reportID, format), nil
}
