// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
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
	_, appErr := a.WriteFile(&buf, makeFilename(prefix, count, "csv"))
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) CompileReportChunks(format string, prefix string, numberOfChunks int, headers []string) (string, *model.AppError) {
	switch format {
	case "csv":
		return a.compileCSVChunks(prefix, numberOfChunks, headers)
	}
	return "", model.NewAppError("CompileReportChunks", "app.compile_report_chunks.unsupported_format", nil, "", http.StatusBadRequest)
}

func (a *App) compileCSVChunks(prefix string, numberOfChunks int, headers []string) (string, *model.AppError) {
	filename := fmt.Sprintf("admin_reports/batch_report_%s.csv", prefix)

	var headerBuf bytes.Buffer
	w := csv.NewWriter(&headerBuf)
	err := w.Write(headers)
	if err != nil {
		return "", model.NewAppError("compileCSVChunks", "app.compile_csv_chunks.header_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	w.Flush()
	_, appErr := a.WriteFile(&headerBuf, filename)
	if appErr != nil {
		return "", appErr
	}

	for i := 0; i < numberOfChunks; i++ {
		chunkFilename := makeFilename(prefix, i, "csv")
		chunk, err := a.ReadFile(chunkFilename)
		if err != nil {
			return "", err
		}
		if _, err = a.AppendFile(bytes.NewReader(chunk), filename); err != nil {
			return "", err
		}
		if err = a.RemoveFile(chunkFilename); err != nil {
			return "", err
		}
	}

	return filename, nil
}

func (a *App) SendReportToUser(userID string, filename string) *model.AppError {
	// TODO
	return nil
}

func makeFilename(prefix string, count int, extension string) string {
	return fmt.Sprintf("admin_reports/batch_report_%s__%d.%s", prefix, count, extension)
}

func (a *App) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	if appErr := filter.IsValid(); appErr != nil {
		return nil, appErr
	}

	return a.getUserReport(filter)
}

func (a *App) getUserReport(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
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

func (a *App) StartUsersBatchExport(rctx request.CTX, dateRange string) *model.AppError {
	options := map[string]string{
		"requesting_user_id": rctx.Session().UserId,
		"date_range":         dateRange,
	}

	// Check for existing job
	// TODO: Maybe make this a reusable function?
	pendingJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, model.JobTypeExportUsersToCSV, model.JobStatusPending)
	if err != nil {
		return err
	}
	for _, job := range pendingJobs {
		if job.Data["date_range"] == dateRange && job.Data["requesting_user_id"] == rctx.Session().UserId {
			return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
		}
	}

	inProgressJobs, err := a.Srv().Jobs.GetJobsByTypeAndStatus(rctx, model.JobTypeExportUsersToCSV, model.JobStatusInProgress)
	if err != nil {
		return err
	}
	for _, job := range inProgressJobs {
		if job.Data["date_range"] == dateRange && job.Data["requesting_user_id"] == rctx.Session().UserId {
			return model.NewAppError("StartUsersBatchExport", "app.report.start_users_batch_export.job_exists", nil, "", http.StatusBadRequest)
		}
	}

	_, err = a.Srv().Jobs.CreateJobOnce(rctx, model.JobTypeExportUsersToCSV, options)
	if err != nil {
		return err
	}

	// TODO: Send system message that we have started the export

	return nil
}
