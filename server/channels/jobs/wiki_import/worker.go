// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wiki_import

import (
	"archive/zip"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type AppIface interface {
	configservice.ConfigService
	RemoveFile(path string) *model.AppError
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	ExportFileExists(path string) (bool, *model.AppError)
	ExportFileSize(path string) (int64, *model.AppError)
	ExportFileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	BulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int) (int, *model.AppError)
	InvalidateCacheForWikiImport(rctx request.CTX, channelIds []string)
	Log() *mlog.Logger
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "WikiImport"

	appContext := request.EmptyContext(jobServer.Logger())
	isEnabled := func(cfg *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		importFileName, ok := job.Data[model.WikiJobDataKeyImportFile]
		if !ok || strings.TrimSpace(importFileName) == "" {
			return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.missing_file", nil, "", http.StatusBadRequest)
		}

		isLocalMode := job.Data[model.WikiJobDataKeyLocalMode] == "true"

		// Validate filename doesn't contain path traversal
		// For local_mode, absolute paths are allowed since we read directly from filesystem
		// For non-local mode, we only allow relative paths within the import directory
		cleanedFilename := filepath.Clean(importFileName)
		if strings.Contains(cleanedFilename, "..") {
			return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_path", map[string]any{"File": importFileName}, "path traversal attempt detected", http.StatusBadRequest)
		}
		if !isLocalMode && filepath.IsAbs(cleanedFilename) {
			return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_path", map[string]any{"File": importFileName}, "absolute paths not allowed in non-local mode", http.StatusBadRequest)
		}

		var importFilePath string
		var importFile filestore.ReadCloseSeeker
		var useExportFilestore bool
		if isLocalMode {
			// Try reading from local filesystem first
			fileInfo, err := os.Stat(importFileName)
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					// File not found locally - try export filestore as fallback
					// This handles HA setups where files are in S3, not local disk
					if app.Config().ExportSettings.Directory == nil || *app.Config().ExportSettings.Directory == "" {
						return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFileName}, "", http.StatusNotFound)
					}
					if app.Config().FileSettings.Directory == nil || *app.Config().FileSettings.Directory == "" {
						return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFileName}, "", http.StatusNotFound)
					}
					exportDir := *app.Config().ExportSettings.Directory
					dataDir := *app.Config().FileSettings.Directory
					exportBasePath := filepath.Join(dataDir, exportDir)

					// Check if the import path is within the export directory
					// Extract the relative path within export directory using CutPrefix
					var exportRelativePath string
					var found bool
					if exportRelativePath, found = strings.CutPrefix(importFileName, exportBasePath); !found {
						exportRelativePath, found = strings.CutPrefix(importFileName, exportDir)
					}
					if found {
						exportRelativePath = strings.TrimPrefix(exportRelativePath, string(filepath.Separator))
						importFilePath = filepath.Join(exportDir, exportRelativePath)

						// Check if file exists in export filestore
						if ok, appErr := app.ExportFileExists(importFilePath); appErr != nil {
							return appErr
						} else if ok {
							useExportFilestore = true
							logger.Debug("File not found locally, using export filestore",
								mlog.String("original_path", importFileName),
								mlog.String("export_path", importFilePath))
						} else {
							return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFileName}, "", http.StatusNotFound)
						}
					} else {
						return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFileName}, "", http.StatusNotFound)
					}
				} else {
					return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.stat_file", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
				}
			}

			if !useExportFilestore {
				if fileInfo.IsDir() {
					return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.is_directory", map[string]any{"File": importFileName}, "", http.StatusBadRequest)
				}

				f, err := os.Open(importFileName)
				if err != nil {
					return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.open_file", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
				}
				defer f.Close()
				importFile = f
			} else {
				// Read from export filestore
				var appErr *model.AppError
				importFile, appErr = app.ExportFileReader(importFilePath)
				if appErr != nil {
					return appErr
				}
				defer importFile.Close()
			}
		} else {
			// Validate config before use
			if app.Config().ImportSettings.Directory == nil || *app.Config().ImportSettings.Directory == "" {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.config.nil_directory", nil, "", http.StatusInternalServerError)
			}

			importFilePath = filepath.Join(*app.Config().ImportSettings.Directory, cleanedFilename)

			// Additional path traversal check: ensure final path is within import directory
			absImportDir, err := filepath.Abs(*app.Config().ImportSettings.Directory)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.abs_path", map[string]any{"Path": *app.Config().ImportSettings.Directory}, "failed to resolve import directory", http.StatusInternalServerError).Wrap(err)
			}
			absImportPath, err := filepath.Abs(importFilePath)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.abs_path", map[string]any{"Path": importFilePath}, "failed to resolve import path", http.StatusInternalServerError).Wrap(err)
			}
			if !strings.HasPrefix(absImportPath, absImportDir) {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_path", map[string]any{"File": importFileName}, "path traversal attempt detected", http.StatusBadRequest)
			}

			if ok, err := app.FileExists(importFilePath); err != nil {
				return err
			} else if !ok {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.file_not_found", map[string]any{"File": importFilePath}, "", http.StatusNotFound)
			}

			var appErr *model.AppError
			importFile, appErr = app.FileReader(importFilePath)
			if appErr != nil {
				return appErr
			}
			defer importFile.Close()

			// Cancel any timeouts for long-running import
			type TimeoutCanceler interface{ CancelTimeout() bool }
			if tc, ok := importFile.(TimeoutCanceler); ok {
				tc.CancelTimeout()
			}
		}

		// Determine if this is a zip file (with attachments) or plain JSONL
		var jsonlReader io.Reader
		var attachmentsReader *zip.Reader

		isZip := strings.HasSuffix(strings.ToLower(importFileName), ".zip")
		if isZip {
			// Get file size for zip.NewReader
			var fileSize int64
			if useExportFilestore {
				var appErr *model.AppError
				fileSize, appErr = app.ExportFileSize(importFilePath)
				if appErr != nil {
					return appErr
				}
			} else if isLocalMode {
				fileInfo, err := os.Stat(importFileName)
				if err != nil {
					return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.stat_file", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
				}
				fileSize = fileInfo.Size()
			} else {
				var appErr *model.AppError
				fileSize, appErr = app.FileSize(importFilePath)
				if appErr != nil {
					return appErr
				}
			}

			// Create zip reader - requires io.ReaderAt which is implemented by underlying file types
			readerAt, ok := importFile.(io.ReaderAt)
			if !ok {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.reader_at", map[string]any{"File": importFileName}, "file does not support random access required for zip reading", http.StatusInternalServerError)
			}
			zipReader, err := zip.NewReader(readerAt, fileSize)
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.invalid_zip", map[string]any{"File": importFileName}, err.Error(), http.StatusBadRequest).Wrap(err)
			}

			// Find the JSONL file in the zip (at data/import.jsonl)
			var jsonlFile *zip.File
			for _, f := range zipReader.File {
				if f.Name == "data/import.jsonl" {
					jsonlFile = f
					break
				}
			}
			if jsonlFile == nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.missing_jsonl", map[string]any{"File": importFileName}, "zip does not contain data/import.jsonl", http.StatusBadRequest)
			}

			// Open the JSONL file for reading
			jsonlFileReader, err := jsonlFile.Open()
			if err != nil {
				return model.NewAppError("WikiImportWorker", "wiki_import.worker.do_job.open_jsonl", map[string]any{"File": importFileName}, err.Error(), http.StatusInternalServerError).Wrap(err)
			}
			defer jsonlFileReader.Close()

			jsonlReader = jsonlFileReader
			attachmentsReader = zipReader
		} else {
			// Plain JSONL file
			jsonlReader = importFile
		}

		lineNumber, appErr := app.BulkImport(appContext, jsonlReader, attachmentsReader, false, 1)
		if appErr != nil {
			logger.Error("Wiki bulk import failed",
				mlog.Int("line_number", lineNumber),
				mlog.String("import_file", importFileName),
				mlog.Err(appErr))
			// Initialize job.Data if nil before writing (defensive check)
			if job.Data == nil {
				job.Data = make(map[string]string)
			}
			job.Data["line_number"] = strconv.Itoa(lineNumber)
			return appErr
		}

		// Clean up import file if not in local mode
		if !isLocalMode {
			if appErr := app.RemoveFile(importFilePath); appErr != nil {
				logger.Warn("Failed to remove import file", mlog.String("path", importFilePath), mlog.Err(appErr))
			}
		}

		// Invalidate caches to ensure all cluster nodes see imported data
		// Note: We don't have channel IDs from the import, so pass empty slice
		// to trigger a general cache clear
		app.InvalidateCacheForWikiImport(appContext, nil)

		return nil
	}

	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
