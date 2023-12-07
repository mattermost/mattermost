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

	err := w.Write(reportData[0].GetHeaders())
	if err != nil {
		return model.NewAppError("saveCSVChunk", "", nil, "failed to write report data to CSV", http.StatusInternalServerError)
	}

	for _, report := range reportData {
		err := w.Write(report.ToReport())
		if err != nil {
			return model.NewAppError("saveCSVChunk", "", nil, "failed to write report data to CSV", http.StatusInternalServerError)
		}
	}

	_, appErr := a.WriteFile(&buf, makeFilename(prefix, count))
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) CompileReportChunks(format string, prefix string, numberOfChunks int) (string, *model.AppError) {
	switch format {
	case "csv":
		return a.compileCSVChunks(prefix, numberOfChunks)
	}
	return "", model.NewAppError("CompileReportChunks", "", nil, "unsupported report format", http.StatusInternalServerError)
}

func (a *App) compileCSVChunks(prefix string, numberOfChunks int) (string, *model.AppError) {
	for i := 0; i < numberOfChunks; i++ {
		var buf bytes.Buffer
		chunk, err := a.ReadFile(makeFilename(prefix, i))
		if err != nil {
			return "", err
		}
		if _, bufErr := buf.Read(chunk); bufErr != nil {
			return "", model.NewAppError("compileCSVChunks", "", nil, bufErr.Error(), http.StatusInternalServerError)
		}
		if _, err = a.AppendFile(&buf, prefix); err != nil {
			return "", err
		}
	}

	return prefix, nil
}

func (a *App) SendReportToUser(userID string, filename string) *model.AppError {
	return nil
}

func makeFilename(prefix string, count int) string {
	return fmt.Sprintf("%s__%d", prefix, count)
}
