// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v6/app/imports"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type ReactionImportData = imports.ReactionImportData // part of the app interface

const (
	importMultiplePostsThreshold = 1000
	maxScanTokenSize             = 16 * 1024 * 1024 // Need to set a higher limit than default because some customers cross the limit. See MM-22314
)

func stopOnError(c request.CTX, err imports.LineImportWorkerError) bool {
	switch err.Error.Id {
	case "api.file.upload_file.large_image.app_error":
		c.Logger().Warn("Large image import error", mlog.Err(err.Error))
		return false
	case "app.import.validate_direct_channel_import_data.members_too_few.error", "app.import.validate_direct_channel_import_data.members_too_many.error":
		c.Logger().Warn("Invalid direct channel import data", mlog.Err(err.Error))
		return false
	default:
		return true
	}
}

func processAttachmentPaths(files *[]imports.AttachmentImportData, basePath string, filesMap map[string]*zip.File) error {
	if files == nil {
		return nil
	}
	var ok bool
	for i, f := range *files {
		if f.Path != nil {
			path := filepath.Join(basePath, *f.Path)
			*f.Path = path
			if len(filesMap) > 0 {
				if (*files)[i].Data, ok = filesMap[path]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	}

	return nil
}

func processAttachments(line *imports.LineImportData, basePath string, filesMap map[string]*zip.File) error {
	var ok bool
	switch line.Type {
	case "post", "direct_post":
		var replies []imports.ReplyImportData
		if line.Type == "direct_post" {
			if err := processAttachmentPaths(line.DirectPost.Attachments, basePath, filesMap); err != nil {
				return err
			}
			if line.DirectPost.Replies != nil {
				replies = *line.DirectPost.Replies
			}
		} else {
			if err := processAttachmentPaths(line.Post.Attachments, basePath, filesMap); err != nil {
				return err
			}
			if line.Post.Replies != nil {
				replies = *line.Post.Replies
			}
		}
		for _, reply := range replies {
			if err := processAttachmentPaths(reply.Attachments, basePath, filesMap); err != nil {
				return err
			}
		}
	case "user":
		if line.User.ProfileImage != nil {
			path := filepath.Join(basePath, *line.User.ProfileImage)
			*line.User.ProfileImage = path
			if len(filesMap) > 0 {
				if line.User.ProfileImageData, ok = filesMap[path]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	case "emoji":
		if line.Emoji.Image != nil {
			path := filepath.Join(basePath, *line.Emoji.Image)
			*line.Emoji.Image = path
			if len(filesMap) > 0 {
				if line.Emoji.Data, ok = filesMap[path]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	}

	return nil
}

func (a *App) bulkImportWorker(c request.CTX, dryRun bool, wg *sync.WaitGroup, lines <-chan imports.LineImportWorkerData, errors chan<- imports.LineImportWorkerError) {
	postLines := []imports.LineImportWorkerData{}
	directPostLines := []imports.LineImportWorkerData{}
	topicalThreadLines := []imports.LineImportWorkerData{}
	for line := range lines {
		switch {
		case line.LineImportData.Type == "post":
			postLines = append(postLines, line)
			if line.Post == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
			}
			if len(postLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultiplePostLines(c, postLines, dryRun); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				postLines = []imports.LineImportWorkerData{}
			}
		case line.LineImportData.Type == "direct_post":
			directPostLines = append(directPostLines, line)
			if line.DirectPost == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_direct_post.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
			}
			if len(directPostLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultipleDirectPostLines(c, directPostLines, dryRun); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				directPostLines = []imports.LineImportWorkerData{}
			}
		case line.LineImportData.Type == "topical_thread":
			topicalThreadLines = append(topicalThreadLines, line)
			if line.TopicalThread == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_topical_thread.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
			}
			if len(topicalThreadLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultipleTopicalThreadLines(c, topicalThreadLines, dryRun); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				topicalThreadLines = []imports.LineImportWorkerData{}
			}
		default:
			if err := a.importLine(c, line.LineImportData, dryRun); err != nil {
				errors <- imports.LineImportWorkerError{Error: err, LineNumber: line.LineNumber}
			}
		}
	}

	if len(postLines) > 0 {
		if errLine, err := a.importMultiplePostLines(c, postLines, dryRun); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
	if len(directPostLines) > 0 {
		if errLine, err := a.importMultipleDirectPostLines(c, directPostLines, dryRun); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
	if len(topicalThreadLines) > 0 {
		if errLine, err := a.importMultipleTopicalThreadLines(c, topicalThreadLines, dryRun); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
	wg.Done()
}

func (a *App) BulkImport(c *request.Context, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int) (*model.AppError, int) {
	return a.bulkImport(c, jsonlReader, attachmentsReader, dryRun, workers, "")
}

func (a *App) BulkImportWithPath(c *request.Context, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int, importPath string) (*model.AppError, int) {
	return a.bulkImport(c, jsonlReader, attachmentsReader, dryRun, workers, importPath)
}

// bulkImport will extract attachments from attachmentsReader if it is
// not nil. If it is nil, it will look for attachments on the
// filesystem in the locations specified by the JSONL file according
// to the older behavior
func (a *App) bulkImport(c request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int, importPath string) (*model.AppError, int) {
	scanner := bufio.NewScanner(jsonlReader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxScanTokenSize)

	lineNumber := 0

	a.Srv().Store().LockToMaster()
	defer a.Srv().Store().UnlockFromMaster()

	errorsChan := make(chan imports.LineImportWorkerError, (2*workers)+1) // size chosen to ensure it never gets filled up completely.
	var wg sync.WaitGroup
	var linesChan chan imports.LineImportWorkerData
	lastLineType := ""

	var attachedFiles map[string]*zip.File
	if attachmentsReader != nil {
		attachedFiles = make(map[string]*zip.File, len(attachmentsReader.File))
		for _, fi := range attachmentsReader.File {
			attachedFiles[fi.Name] = fi
		}
	}

	for scanner.Scan() {
		decoder := json.NewDecoder(bytes.NewReader(scanner.Bytes()))
		lineNumber++

		var line imports.LineImportData
		if err := decoder.Decode(&line); err != nil {
			return model.NewAppError("BulkImport", "app.import.bulk_import.json_decode.error", nil, "", http.StatusBadRequest).Wrap(err), lineNumber
		}

		if err := processAttachments(&line, importPath, attachedFiles); err != nil {
			c.Logger().Warn("Error while processing import attachments. Objects might be broken.", mlog.Err(err))
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
					if stopOnError(c, err) {
						return err.Error, err.LineNumber
					}
				}
			}

			// Set up the workers and channel for this type.
			lastLineType = line.Type
			linesChan = make(chan imports.LineImportWorkerData, workers)
			for i := 0; i < workers; i++ {
				wg.Add(1)
				go a.bulkImportWorker(c, dryRun, &wg, linesChan, errorsChan)
			}
		}

		select {
		case linesChan <- imports.LineImportWorkerData{LineImportData: line, LineNumber: lineNumber}:
		case err := <-errorsChan:
			if stopOnError(c, err) {
				close(linesChan)
				wg.Wait()
				return err.Error, err.LineNumber
			}
		}
	}

	// No more lines. Clear out the worker queue before continuing.
	if linesChan != nil {
		close(linesChan)
	}
	wg.Wait()

	// Check no errors occurred while waiting for the queue to empty.
	if len(errorsChan) != 0 {
		err := <-errorsChan
		if stopOnError(c, err) {
			return err.Error, err.LineNumber
		}
	}

	if err := scanner.Err(); err != nil {
		return model.NewAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, "", http.StatusInternalServerError).Wrap(err), 0
	}

	return nil, 0
}

func processImportDataFileVersionLine(line imports.LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func (a *App) importLine(c request.CTX, line imports.LineImportData, dryRun bool) *model.AppError {
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
		return a.importTeam(c, line.Team, dryRun)
	case line.Type == "channel":
		if line.Channel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importChannel(c, line.Channel, dryRun)
	case line.Type == "user":
		if line.User == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_user.error", nil, "", http.StatusBadRequest)
		}
		return a.importUser(c, line.User, dryRun)
	case line.Type == "direct_channel":
		if line.DirectChannel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importDirectChannel(c, line.DirectChannel, dryRun)
	case line.Type == "emoji":
		if line.Emoji == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_emoji.error", nil, "", http.StatusBadRequest)
		}
		return a.importEmoji(line.Emoji, dryRun)
	default:
		return model.NewAppError("BulkImport", "app.import.import_line.unknown_line_type.error", map[string]any{"Type": line.Type}, "", http.StatusBadRequest)
	}
}

func (a *App) ListImports() ([]string, *model.AppError) {
	imports, appErr := a.ListDirectory(*a.Config().ImportSettings.Directory)
	if appErr != nil {
		return nil, appErr
	}

	results := make([]string, 0, len(imports))
	for i := 0; i < len(imports); i++ {
		filename := filepath.Base(imports[i])
		if !strings.HasSuffix(filename, model.IncompleteUploadSuffix) {
			results = append(results, filename)
		}
	}

	return results, nil
}
