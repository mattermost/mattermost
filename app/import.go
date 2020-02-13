// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"

	"github.com/mattermost/mattermost-server/v5/model"
)

func stopOnError(err LineImportWorkerError) bool {
	if err.Error.Id == "api.file.upload_file.large_image.app_error" {
		mlog.Warn("Large image import error", mlog.Err(err.Error))
		return false
	}
	return true
}

func (a *App) bulkImportWorker(dryRun bool, wg *sync.WaitGroup, lines <-chan LineImportWorkerData, errors chan<- LineImportWorkerError) {
	for line := range lines {
		if err := a.importLine(line.LineImportData, dryRun); err != nil {
			errors <- LineImportWorkerError{err, line.LineNumber}
		}
	}
	wg.Done()
}

func (a *App) BulkImport(fileReader io.Reader, dryRun bool, workers int) (*model.AppError, int) {
	scanner := bufio.NewScanner(fileReader)
	lineNumber := 0

	a.Srv.Store.LockToMaster()
	defer a.Srv.Store.UnlockFromMaster()

	errorsChan := make(chan LineImportWorkerError, (2*workers)+1) // size chosen to ensure it never gets filled up completely.
	var wg sync.WaitGroup
	var linesChan chan LineImportWorkerData
	lastLineType := ""

	for scanner.Scan() {
		decoder := json.NewDecoder(strings.NewReader(scanner.Text()))
		lineNumber++

		var line LineImportData
		if err := decoder.Decode(&line); err != nil {
			return model.NewAppError("BulkImport", "app.import.bulk_import.json_decode.error", nil, err.Error(), http.StatusBadRequest), lineNumber
		}

		if lineNumber == 1 {
			importDataFileVersion, appErr := processImportDataFileVersionLine(line)
			if appErr != nil {
				return appErr, lineNumber
			}

			if importDataFileVersion != 1 {
				return model.NewAppError("BulkImport", "app.import.bulk_import.unsupported_version.error", nil, "", http.StatusBadRequest), lineNumber
			}
			lastLineType = line.Type
			continue
		}

		if line.Type != lastLineType {
			// Only clear the worker queue if is not the first data entry
			if lineNumber != 2 {
				// Changing type. Clear out the worker queue before continuing.
				close(linesChan)
				wg.Wait()

				// Check no errors occurred while waiting for the queue to empty.
				if len(errorsChan) != 0 {
					err := <-errorsChan
					if stopOnError(err) {
						return err.Error, err.LineNumber
					}
				}
			}

			// Set up the workers and channel for this type.
			lastLineType = line.Type
			linesChan = make(chan LineImportWorkerData, workers)
			for i := 0; i < workers; i++ {
				wg.Add(1)
				go a.bulkImportWorker(dryRun, &wg, linesChan, errorsChan)
			}
		}

		select {
		case linesChan <- LineImportWorkerData{line, lineNumber}:
		case err := <-errorsChan:
			if stopOnError(err) {
				close(linesChan)
				wg.Wait()
				return err.Error, err.LineNumber
			}
		}
	}

	// No more lines. Clear out the worker queue before continuing.
	close(linesChan)
	wg.Wait()

	// Check no errors occurred while waiting for the queue to empty.
	if len(errorsChan) != 0 {
		err := <-errorsChan
		if stopOnError(err) {
			return err.Error, err.LineNumber
		}
	}

	if err := scanner.Err(); err != nil {
		return model.NewAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, err.Error(), http.StatusInternalServerError), 0
	}

	if err := a.finalizeImport(dryRun); err != nil {
		return err, 0
	}

	return nil, 0
}

func processImportDataFileVersionLine(line LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func (a *App) importLine(line LineImportData, dryRun bool) *model.AppError {
	switch {
	case line.Type == "scheme":
		if line.Scheme == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_scheme.error", nil, "", http.StatusBadRequest)
		}
		return a.importScheme(line.Scheme, dryRun)
	case line.Type == "team":
		if line.Team == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_team.error", nil, "", http.StatusBadRequest)
		}
		return a.importTeam(line.Team, dryRun)
	case line.Type == "channel":
		if line.Channel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importChannel(line.Channel, dryRun)
	case line.Type == "user":
		if line.User == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_user.error", nil, "", http.StatusBadRequest)
		}
		return a.importUser(line.User, dryRun)
	case line.Type == "post":
		if line.Post == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest)
		}
		return a.importPost(line.Post, dryRun)
	case line.Type == "direct_channel":
		if line.DirectChannel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importDirectChannel(line.DirectChannel, dryRun)
	case line.Type == "direct_post":
		if line.DirectPost == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_post.error", nil, "", http.StatusBadRequest)
		}
		return a.importDirectPost(line.DirectPost, dryRun)
	case line.Type == "emoji":
		if line.Emoji == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_emoji.error", nil, "", http.StatusBadRequest)
		}
		return a.importEmoji(line.Emoji, dryRun)
	default:
		return model.NewAppError("BulkImport", "app.import.import_line.unknown_line_type.error", map[string]interface{}{"Type": line.Type}, "", http.StatusBadRequest)
	}
}

func (a *App) finalizeImport(dryRun bool) *model.AppError {
	if dryRun {
		return nil
	}
	return nil
}
