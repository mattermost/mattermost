// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SaveReportChunk(format string, prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	switch format {
	case "csv":
		return a.saveCSVChunk(prefix, count, reportData)
	}
	return model.NewAppError("SaveReportChunk", "", nil, "unsupported report format", http.StatusInternalServerError)
}

func (a *App) saveCSVChunk(prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	for _, report := range reportData {
		err := w.Write(report.ToReport())
		if err != nil {
			return model.NewAppError("saveCSVChunk", "", nil, "failed to write report data to CSV", http.StatusInternalServerError)
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
	return "", model.NewAppError("CompileReportChunks", "", nil, "unsupported report format", http.StatusInternalServerError)
}

func (a *App) compileCSVChunks(prefix string, numberOfChunks int, headers []string) (string, *model.AppError) {
	filename := fmt.Sprintf("batch_report_%s.csv", prefix)

	var headerBuf bytes.Buffer
	w := csv.NewWriter(&headerBuf)
	err := w.Write(headers)
	if err != nil {
		return "", model.NewAppError("compileCSVChunks", "", nil, "failed to write headers", http.StatusInternalServerError)
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
	return nil
}

func makeFilename(prefix string, count int, extension string) string {
	return fmt.Sprintf("batch_report_%s__%d.%s", prefix, count, extension)
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
