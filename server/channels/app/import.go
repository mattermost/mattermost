// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

type ReactionImportData = imports.ReactionImportData // part of the app interface

const (
	importMultiplePostsThreshold = 1000
	maxScanTokenSize             = 16 * 1024 * 1024 // Need to set a higher limit than default because some customers cross the limit. See MM-22314
	statusUpdateAfterLines       = 8192
)

func stopOnError(rctx request.CTX, err imports.LineImportWorkerError) bool {
	switch err.Error.Id {
	case "api.file.upload_file.large_image.app_error":
		rctx.Logger().Warn("Large image import error", mlog.Err(err.Error))
		return false
	case "app.import.validate_direct_channel_import_data.members_too_few.error", "app.import.validate_direct_channel_import_data.members_too_many.error":
		rctx.Logger().Warn("Invalid direct channel import data", mlog.Err(err.Error))
		return false
	default:
		return true
	}
}

func processAttachmentPaths(rctx request.CTX, files *[]imports.AttachmentImportData, basePath string, filesMap map[string]*zip.File) error {
	if files == nil {
		return nil
	}

	var ok bool
	var errs []error
	for i, f := range *files {
		if f.Path != nil {
			originalPath := *f.Path

			path, valid := imports.ValidateAttachmentPathForImport(originalPath, basePath)

			*f.Path = path

			if !valid {
				errs = append(errs, fmt.Errorf("invalid attachment path %q", originalPath))
				continue
			}

			if len(filesMap) > 0 {
				if (*files)[i].Data, ok = filesMap[*f.Path]; !ok {
					errs = append(errs, fmt.Errorf("attachment %q not found in map", originalPath))
					continue
				}
			}
		}
	}

	return errors.Join(errs...)
}

func processAttachments(rctx request.CTX, line *imports.LineImportData, basePath string, filesMap map[string]*zip.File) error {
	var ok bool
	switch line.Type {
	case "post", "direct_post":
		var replies []imports.ReplyImportData
		if line.Type == "direct_post" {
			if err := processAttachmentPaths(rctx, line.DirectPost.Attachments, basePath, filesMap); err != nil {
				return err
			}
			if line.DirectPost.Replies != nil {
				replies = *line.DirectPost.Replies
			}
		} else {
			if err := processAttachmentPaths(rctx, line.Post.Attachments, basePath, filesMap); err != nil {
				return err
			}
			if line.Post.Replies != nil {
				replies = *line.Post.Replies
			}
		}
		for _, reply := range replies {
			if err := processAttachmentPaths(rctx, reply.Attachments, basePath, filesMap); err != nil {
				return err
			}
		}
	case "user":
		if line.User.ProfileImage != nil {
			path, valid := imports.ValidateAttachmentPathForImport(*line.User.ProfileImage, basePath)
			if !valid {
				return fmt.Errorf("invalid profile image path %q", *line.User.ProfileImage)
			}

			*line.User.ProfileImage = path
			if len(filesMap) > 0 {
				if line.User.ProfileImageData, ok = filesMap[path]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	case "bot":
		if line.Bot.ProfileImage != nil {
			path, valid := imports.ValidateAttachmentPathForImport(*line.Bot.ProfileImage, basePath)
			if !valid {
				return fmt.Errorf("invalid bot profile image path %q", *line.Bot.ProfileImage)
			}

			*line.Bot.ProfileImage = path
			if len(filesMap) > 0 {
				if line.Bot.ProfileImageData, ok = filesMap[path]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	case "emoji":
		if line.Emoji.Image != nil {
			path, valid := imports.ValidateAttachmentPathForImport(*line.Emoji.Image, basePath)
			if !valid {
				return fmt.Errorf("invalid emoji image path %q", *line.Emoji.Image)
			}

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

func (a *App) bulkImportWorker(rctx request.CTX, dryRun, extractContent bool, wg *sync.WaitGroup, lines <-chan imports.LineImportWorkerData, errors chan<- imports.LineImportWorkerError) {
	workerID := model.NewId()
	processedLines := uint64(0)

	rctx.Logger().Info("Started new bulk import worker", mlog.String("bulk_import_worker_id", workerID))
	defer func() {
		wg.Done()
		rctx.Logger().Info("Bulk import worker finished", mlog.String("bulk_import_worker_id", workerID), mlog.Uint("processed_lines", processedLines))
	}()

	postLines := []imports.LineImportWorkerData{}
	directPostLines := []imports.LineImportWorkerData{}
	for line := range lines {
		switch {
		case line.LineImportData.Type == "post":
			postLines = append(postLines, line)
			if line.Post == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
			}
			if len(postLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultiplePostLines(rctx, postLines, dryRun, extractContent); err != nil {
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
				if errLine, err := a.importMultipleDirectPostLines(rctx, directPostLines, dryRun, extractContent); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				directPostLines = []imports.LineImportWorkerData{}
			}
		default:
			if err := a.importLine(rctx, line.LineImportData, dryRun); err != nil {
				errors <- imports.LineImportWorkerError{Error: err, LineNumber: line.LineNumber}
			}
		}

		processedLines++
		if processedLines%statusUpdateAfterLines == 0 {
			rctx.Logger().Info("Worker progress", mlog.String("bulk_import_worker_id", workerID), mlog.Uint("processed_lines", processedLines))
		}
	}

	if len(postLines) > 0 {
		if errLine, err := a.importMultiplePostLines(rctx, postLines, dryRun, extractContent); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
	if len(directPostLines) > 0 {
		if errLine, err := a.importMultipleDirectPostLines(rctx, directPostLines, dryRun, extractContent); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
}

func (a *App) BulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int) (int, *model.AppError) {
	return a.bulkImport(rctx, jsonlReader, attachmentsReader, dryRun, true, workers, "")
}

func (a *App) BulkImportWithPath(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string) (int, *model.AppError) {
	return a.bulkImport(rctx, jsonlReader, attachmentsReader, dryRun, extractContent, workers, importPath)
}

// bulkImport will extract attachments from attachmentsReader if it is
// not nil. If it is nil, it will look for attachments on the
// filesystem in the locations specified by the JSONL file according
// to the older behavior
func (a *App) bulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string) (int, *model.AppError) {
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
		lineNumber++
		if lineNumber%statusUpdateAfterLines == 0 {
			rctx.Logger().Info("Reader progress", mlog.Int("processed_lines", lineNumber))
		}

		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			return lineNumber, model.NewAppError("BulkImport", "app.import.bulk_import.json_decode.error", nil, "", http.StatusBadRequest).Wrap(err)
		}

		if err := processAttachments(rctx, &line, importPath, attachedFiles); err != nil {
			rctx.Logger().Warn("Error while processing import attachments. Objects might be broken.", mlog.Err(err))
		}

		if lineNumber == 1 {
			importDataFileVersion, appErr := processImportDataFileVersionLine(line)
			if appErr != nil {
				return lineNumber, appErr
			}

			if importDataFileVersion != 1 {
				return lineNumber, model.NewAppError("BulkImport", "app.import.bulk_import.unsupported_version.error", nil, "", http.StatusBadRequest)
			}
			lastLineType = line.Type
			continue
		}

		if line.Type != lastLineType {
			// Only clear the worker queue if is not the first data entry
			if lineNumber != 2 {
				rctx.Logger().Info(
					"Finished parsing segment, waiting for workers to finish",
					mlog.String("old_segment", lastLineType),
					mlog.String("new_segment", line.Type),
				)

				// Changing type. Clear out the worker queue before continuing.
				close(linesChan)
				wg.Wait()

				// Check no errors occurred while waiting for the queue to empty.
				if len(errorsChan) != 0 {
					err := <-errorsChan
					if stopOnError(rctx, err) {
						return err.LineNumber, err.Error
					}
				}
			}

			rctx.Logger().Info(
				"Starting workers for new segment",
				mlog.String("old_segment", lastLineType),
				mlog.String("new_segment", line.Type),
				mlog.Int("workers", workers),
			)

			// Set up the workers and channel for this type.
			lastLineType = line.Type
			linesChan = make(chan imports.LineImportWorkerData, workers)
			for range workers {
				wg.Add(1)
				go a.bulkImportWorker(rctx, dryRun, extractContent, &wg, linesChan, errorsChan)
			}
		}

		select {
		case linesChan <- imports.LineImportWorkerData{LineImportData: line, LineNumber: lineNumber}:
		case err := <-errorsChan:
			if stopOnError(rctx, err) {
				close(linesChan)
				wg.Wait()
				return err.LineNumber, err.Error
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
		if stopOnError(rctx, err) {
			return err.LineNumber, err.Error
		}
	}

	if err := scanner.Err(); err != nil {
		return 0, model.NewAppError("BulkImport", "app.import.bulk_import.file_scan.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return 0, nil
}

func processImportDataFileVersionLine(line imports.LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func (a *App) importLine(rctx request.CTX, line imports.LineImportData, dryRun bool) *model.AppError {
	switch {
	case line.Type == "role":
		if line.Role == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_role.error", nil, "", http.StatusBadRequest)
		}
		return a.importRole(rctx, line.Role, dryRun)
	case line.Type == "scheme":
		if line.Scheme == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_scheme.error", nil, "", http.StatusBadRequest)
		}
		return a.importScheme(rctx, line.Scheme, dryRun)
	case line.Type == "team":
		if line.Team == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_team.error", nil, "", http.StatusBadRequest)
		}
		return a.importTeam(rctx, line.Team, dryRun)
	case line.Type == "channel":
		if line.Channel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importChannel(rctx, line.Channel, dryRun)
	case line.Type == "user":
		if line.User == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_user.error", nil, "", http.StatusBadRequest)
		}
		return a.importUser(rctx, line.User, dryRun)
	case line.Type == "bot":
		if line.Bot == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_bot.error", nil, "", http.StatusBadRequest)
		}
		return a.importBot(rctx, line.Bot, dryRun)
	case line.Type == "direct_channel":
		if line.DirectChannel == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_direct_channel.error", nil, "", http.StatusBadRequest)
		}
		return a.importDirectChannel(rctx, line.DirectChannel, dryRun)
	case line.Type == "emoji":
		if line.Emoji == nil {
			return model.NewAppError("BulkImport", "app.import.import_line.null_emoji.error", nil, "", http.StatusBadRequest)
		}
		return a.importEmoji(rctx, line.Emoji, dryRun)
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
	for i := range imports {
		filename := filepath.Base(imports[i])
		if !strings.HasSuffix(filename, model.IncompleteUploadSuffix) {
			results = append(results, filename)
		}
	}

	return results, nil
}

func (a *App) DeleteImport(name string) *model.AppError {
	filePath := filepath.Join(*a.Config().ImportSettings.Directory, name)

	if ok, err := a.FileExists(filePath); err != nil {
		return err
	} else if !ok {
		return nil
	}

	return a.RemoveFile(filePath)
}
