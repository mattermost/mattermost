// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SaveReportChunk(format string, filename string, reportData []interface{}) *model.AppError {
	switch format {
	case "csv":
		return a.saveCSVChunk(filename, reportData)
	}
	return model.NewAppError("SaveReportChunk", "", nil, "unsupported report format", http.StatusInternalServerError)
}

func (a *App) saveCSVChunk(filename string, reportData []interface{}) *model.AppError {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// TODO: Fill this array with report data
	records := [][]string{}

	err := w.WriteAll(records)
	if err != nil {
		return model.NewAppError("saveCSVChunk", "", nil, "failed to write report data to CSV", http.StatusInternalServerError)
	}
	_, appErr := a.WriteFile(&buf, filename)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) CompileReportChunks(format string, filenames []string) (string, error) {
	switch format {
	case "csv":
		return a.compileCSVChunks(filenames)
	}
	return "", errors.New("unsupported report format")
}

func (a *App) compileCSVChunks(filenames []string) (string, error) {
	return "", nil
}

func (a *App) SendReportToUser(userID string, filename string) error {
	return nil
}
