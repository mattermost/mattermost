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
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
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
				normalizedPath := utils.NormalizeFilename(*f.Path)
				if (*files)[i].Data, ok = filesMap[normalizedPath]; !ok {
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
				normalizedPath := utils.NormalizeFilename(path)
				if line.User.ProfileImageData, ok = filesMap[normalizedPath]; !ok {
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
				normalizedPath := utils.NormalizeFilename(path)
				if line.Bot.ProfileImageData, ok = filesMap[normalizedPath]; !ok {
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
				normalizedPath := utils.NormalizeFilename(path)
				if line.Emoji.Data, ok = filesMap[normalizedPath]; !ok {
					return fmt.Errorf("attachment %q not found in map", path)
				}
			}
		}
	}

	return nil
}

func (a *App) bulkImportWorker(rctx request.CTX, dryRun, extractContent, deactivateMissingUsers bool, report *imports.ImportReport, wg *sync.WaitGroup, lines <-chan imports.LineImportWorkerData, errors chan<- imports.LineImportWorkerError) {
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
			if line.Post == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_post.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
				continue
			}
			postLines = append(postLines, line)
			if len(postLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultiplePostLines(rctx, postLines, dryRun, extractContent, deactivateMissingUsers, report); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				postLines = []imports.LineImportWorkerData{}
			}
		case line.LineImportData.Type == "direct_post":
			if line.DirectPost == nil {
				errors <- imports.LineImportWorkerError{Error: model.NewAppError("BulkImport", "app.import.import_line.null_direct_post.error", nil, "", http.StatusBadRequest), LineNumber: line.LineNumber}
				continue
			}
			directPostLines = append(directPostLines, line)
			if len(directPostLines) >= importMultiplePostsThreshold {
				if errLine, err := a.importMultipleDirectPostLines(rctx, directPostLines, dryRun, extractContent, deactivateMissingUsers, report); err != nil {
					errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
				}
				directPostLines = []imports.LineImportWorkerData{}
			}
		default:
			if err := a.importLine(rctx, line.LineImportData, dryRun, deactivateMissingUsers, report); err != nil {
				errors <- imports.LineImportWorkerError{Error: err, LineNumber: line.LineNumber}
			}
		}

		processedLines++
		if processedLines%statusUpdateAfterLines == 0 {
			rctx.Logger().Info("Worker progress", mlog.String("bulk_import_worker_id", workerID), mlog.Uint("processed_lines", processedLines))
		}
	}

	if len(postLines) > 0 {
		if errLine, err := a.importMultiplePostLines(rctx, postLines, dryRun, extractContent, deactivateMissingUsers, report); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
	if len(directPostLines) > 0 {
		if errLine, err := a.importMultipleDirectPostLines(rctx, directPostLines, dryRun, extractContent, deactivateMissingUsers, report); err != nil {
			errors <- imports.LineImportWorkerError{Error: err, LineNumber: errLine}
		}
	}
}

func (a *App) BulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun bool, workers int) (int, *model.AppError) {
	_, err := a.bulkImport(rctx, jsonlReader, attachmentsReader, dryRun, true, workers, "", "", "", false, 0, nil, &imports.ImportReport{})
	return 0, err
}

func (a *App) BulkImportWithPath(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string) (int, *model.AppError) {
	lineNumber, err := a.bulkImport(rctx, jsonlReader, attachmentsReader, dryRun, extractContent, workers, importPath, "", "", false, 0, nil, &imports.ImportReport{})
	return lineNumber, err
}

func (a *App) BulkImportWithPathAndOpts(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string, opts model.BulkImportOpts) (int, *model.AppError) {
	report := &imports.ImportReport{}
	lineNumber, err := a.bulkImport(rctx, jsonlReader, attachmentsReader, dryRun, extractContent, workers, importPath, opts.DestinationTeamName, opts.DestinationChannelName, opts.SkipPreflight, opts.ResumeFromLine, opts.OnCheckpoint, report)
	return lineNumber, err
}

// bulkImport will extract attachments from attachmentsReader if it is
// not nil. If it is nil, it will look for attachments on the
// filesystem in the locations specified by the JSONL file according
// to the older behavior
func (a *App) bulkImport(rctx request.CTX, jsonlReader io.Reader, attachmentsReader *zip.Reader, dryRun, extractContent bool, workers int, importPath string, destinationTeam string, destinationChannel string, skipPreflight bool, resumeFromLine int, onCheckpoint func(int), report *imports.ImportReport) (int, *model.AppError) {
	scanner := bufio.NewScanner(jsonlReader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxScanTokenSize)

	lineNumber := 0
	deactivateMissingUsers := false
	sourceTeamName := ""
	sourceChannelName := ""

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
			attachedFiles[utils.NormalizeFilename(fi.Name)] = fi
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

			if line.Info != nil && len(line.Info.Additional) > 0 {
				var scope imports.ExportScopeAdditional
				if err := json.Unmarshal(line.Info.Additional, &scope); err != nil {
					rctx.Logger().Warn("Failed to decode export scope metadata; proceeding as unscoped import", mlog.Err(err))
				} else {
					sourceTeamName = scope.TeamName
					sourceChannelName = scope.ChannelName
					if destinationChannel != "" && sourceChannelName == "" {
						return lineNumber, model.NewAppError("BulkImport", "app.import.bulk_import.destination_channel_requires_channel_scope.error", nil, "--destination-channel-name requires a channel-scoped export", http.StatusBadRequest)
					}
					if scope.ChannelName != "" || scope.TeamName != "" {
						deactivateMissingUsers = true
						if attachmentsReader != nil {
							if appErr := a.checkSSOProviderConfig(rctx, attachmentsReader, skipPreflight); appErr != nil {
								return lineNumber, appErr
							}
							totalLines := a.preCreateSSOUsers(rctx, attachmentsReader, dryRun)
							if onCheckpoint != nil && totalLines > 0 {
								// Store total line count early so a later failure
								// can show percentage progress on resume.
								onCheckpoint(-totalLines)
							}
						}
					}
				}
			}

			lastLineType = line.Type
			continue
		}

		// Skip post/direct_post lines already processed before the checkpoint.
		// Non-post segments (roles, teams, channels, users, bots) are always
		// re-processed to ensure consistent state — remap rebuilt, teams/channels
		// exist, etc. This is safe because all non-post operations are idempotent.
		if resumeFromLine > 0 && lineNumber <= resumeFromLine &&
			(line.Type == "post" || line.Type == "direct_post") {
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

				// Checkpoint after each completed segment so a crashed import
				// can resume without restarting from line 1.
				if onCheckpoint != nil {
					onCheckpoint(lineNumber - 1)
				}

				// Check no errors occurred while waiting for the queue to empty.
				for len(errorsChan) != 0 {
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
				go a.bulkImportWorker(rctx, dryRun, extractContent, deactivateMissingUsers, report, &wg, linesChan, errorsChan)
			}
		}

		// When ExportScopeAdditional is absent (e.g. full-team export from older binaries),
		// infer sourceTeamName from the first team line so --destination-team still works.
		if destinationTeam != "" && sourceTeamName == "" && line.Type == "team" && line.Team != nil && line.Team.Name != nil {
			sourceTeamName = *line.Team.Name
		}

		if destinationTeam != "" && sourceTeamName != "" {
			rewriteTeamName(&line, sourceTeamName, destinationTeam)
		}
		if destinationChannel != "" && sourceChannelName != "" {
			rewriteChannelName(&line, sourceChannelName, destinationChannel)
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

	// Final checkpoint — all content processed successfully.
	if onCheckpoint != nil {
		onCheckpoint(lineNumber)
	}

	// Check no errors occurred while waiting for the queue to empty.
	for len(errorsChan) != 0 {
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

// rewriteTeamName replaces all references to sourceTeam with destTeam in a
// parsed import line, enabling --destination-team remapping on import.
func rewriteTeamName(line *imports.LineImportData, sourceTeam, destTeam string) {
	switch line.Type {
	case "team":
		if line.Team != nil && line.Team.Name != nil && *line.Team.Name == sourceTeam {
			*line.Team.Name = destTeam
		}
	case "channel":
		if line.Channel != nil && line.Channel.Team != nil && *line.Channel.Team == sourceTeam {
			*line.Channel.Team = destTeam
		}
	case "user":
		if line.User != nil && line.User.Teams != nil {
			for i := range *line.User.Teams {
				if (*line.User.Teams)[i].Name != nil && *(*line.User.Teams)[i].Name == sourceTeam {
					*(*line.User.Teams)[i].Name = destTeam
				}
			}
		}
	case "post":
		if line.Post != nil && line.Post.Team != nil && *line.Post.Team == sourceTeam {
			*line.Post.Team = destTeam
		}
	}
}

// rewriteChannelName replaces all references to sourceChannel with destChannel
// in a parsed import line, enabling --destination-channel-name remapping on import.
func rewriteChannelName(line *imports.LineImportData, sourceChannel, destChannel string) {
	switch line.Type {
	case "channel":
		if line.Channel != nil && line.Channel.Name != nil && *line.Channel.Name == sourceChannel {
			*line.Channel.Name = destChannel
		}
	case "user":
		if line.User == nil || line.User.Teams == nil {
			return
		}
		for i := range *line.User.Teams {
			team := &(*line.User.Teams)[i]
			if team.Channels == nil {
				continue
			}
			for j := range *team.Channels {
				ch := &(*team.Channels)[j]
				if ch.Name != nil && *ch.Name == sourceChannel {
					*ch.Name = destChannel
				}
			}
		}
	case "post":
		if line.Post != nil && line.Post.Channel != nil && *line.Post.Channel == sourceChannel {
			*line.Post.Channel = destChannel
		}
	}
}

func processImportDataFileVersionLine(line imports.LineImportData) (int, *model.AppError) {
	if line.Type != "version" || line.Version == nil {
		return -1, model.NewAppError("BulkImport", "app.import.process_import_data_file_version_line.invalid_version.error", nil, "", http.StatusBadRequest)
	}

	return *line.Version, nil
}

func (a *App) importLine(rctx request.CTX, line imports.LineImportData, dryRun bool, deactivateMissingUsers bool, report *imports.ImportReport) *model.AppError {
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
		return a.importUser(rctx, line.User, dryRun, deactivateMissingUsers, report)
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

// checkSSOProviderConfig scans the export for SSO user accounts and fails when
// the corresponding auth provider is not enabled on the destination. This prevents
// silent deactivated shells for users whose auth provider is misconfigured.
// For LDAP and SAML it also logs the configured IdAttribute and IdP URL so admins
// can verify they match the source before proceeding.
//
// Returns a non-nil AppError if any hard mismatch is detected. Callers that set
// skipPreflight=true skip all checks and log a warning instead.
func (a *App) checkSSOProviderConfig(rctx request.CTX, zipReader *zip.Reader, skipPreflight bool) *model.AppError {
	var jsonlEntry *zip.File
	for _, f := range zipReader.File {
		if imports.IsRootJsonlFile(f.Name) {
			jsonlEntry = f
			break
		}
	}
	if jsonlEntry == nil {
		return nil
	}

	rc, err := jsonlEntry.Open()
	if err != nil {
		return nil
	}
	defer rc.Close()

	scanner := bufio.NewScanner(rc)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxScanTokenSize)

	seen := make(map[string]struct{})
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		if lineNumber == 1 {
			continue
		}
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type != "user" {
			continue
		}
		if line.User == nil || line.User.AuthService == nil || *line.User.AuthService == "" {
			continue
		}
		svc := *line.User.AuthService
		if _, already := seen[svc]; already {
			continue
		}
		seen[svc] = struct{}{}

		cfg := a.Config()

		providerEnabled := false
		var failMsg string

		switch svc {
		case model.UserAuthServiceLdap:
			if !*cfg.LdapSettings.Enable {
				failMsg = "export contains LDAP users but LDAP is not enabled on the destination"
			} else if *cfg.LdapSettings.IdAttribute == "" {
				failMsg = "LdapSettings.IdAttribute is empty on the destination — auth_data matching will fail for LDAP users"
			} else {
				providerEnabled = true
				rctx.Logger().Info("PREFLIGHT: LDAP configured on destination",
					mlog.String("id_attribute", *cfg.LdapSettings.IdAttribute))
			}
		case model.UserAuthServiceSaml:
			if !*cfg.SamlSettings.Enable {
				failMsg = "export contains SAML users but SAML is not enabled on the destination"
			} else {
				providerEnabled = true
				rctx.Logger().Info("PREFLIGHT: SAML configured on destination",
					mlog.String("id_attribute", *cfg.SamlSettings.IdAttribute),
					mlog.String("idp_url", *cfg.SamlSettings.IdpURL))
			}
		case model.ServiceGitlab:
			if !*cfg.GitLabSettings.Enable {
				failMsg = "export contains GitLab OAuth users but GitLab OAuth is not enabled on the destination"
			} else {
				providerEnabled = true
			}
		case model.ServiceGoogle:
			if !*cfg.GoogleSettings.Enable {
				failMsg = "export contains Google OAuth users but Google OAuth is not enabled on the destination"
			} else {
				providerEnabled = true
			}
		case model.ServiceOffice365:
			if !*cfg.Office365Settings.Enable {
				failMsg = "export contains Office 365 OAuth users but Office 365 OAuth is not enabled on the destination"
			} else {
				providerEnabled = true
			}
		case model.ServiceOpenid:
			if !*cfg.OpenIdSettings.Enable {
				failMsg = "export contains OpenID users but OpenID is not enabled on the destination"
			} else {
				providerEnabled = true
			}
		default:
			providerEnabled = true
		}

		if !providerEnabled && failMsg != "" {
			if skipPreflight {
				rctx.Logger().Warn("PREFLIGHT (skipped): "+failMsg+" — proceeding anyway as --skip-preflight was set",
					mlog.String("auth_service", svc))
			} else {
				return model.NewAppError("BulkImport", "app.import.preflight.auth_provider_not_configured.error",
					map[string]any{"Service": svc, "Detail": failMsg}, "", http.StatusBadRequest)
			}
		}
	}
	return nil
}

// preCreateSSOUsers does a lightweight first pass over the JSONL to create SSO
// user accounts on the dest before the main import runs. This ensures every
// SAML/LDAP/OpenID user has a record with their auth_data set so the main pass
// can match them by auth_data rather than creating deactivated shells.
//
// Only users with auth_service + auth_data are handled here — email-auth users
// are skipped (no auth_data to anchor on, and they don't benefit from pre-creation).
// Team/channel memberships, preferences, and profile images are intentionally
// omitted; the main pass populates those after teams and channels exist on dest.
// preCreateSSOUsers returns the total number of lines in the JSONL so callers
// can store it for percentage display on resume.
func (a *App) preCreateSSOUsers(rctx request.CTX, zipReader *zip.Reader, dryRun bool) int {
	var jsonlEntry *zip.File
	for _, f := range zipReader.File {
		if imports.IsRootJsonlFile(f.Name) {
			jsonlEntry = f
			break
		}
	}
	if jsonlEntry == nil {
		return 0
	}

	rc, err := jsonlEntry.Open()
	if err != nil {
		rctx.Logger().Warn("preCreateSSOUsers: failed to open JSONL for pre-creation pass", mlog.Err(err))
		return 0
	}
	defer rc.Close()

	scanner := bufio.NewScanner(rc)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxScanTokenSize)

	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		if lineNumber == 1 {
			continue // skip version line
		}

		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}

		if line.Type != "user" {
			continue // skip roles, teams, channels, etc. — only process user lines
		}

		if line.User == nil ||
			line.User.AuthService == nil ||
			line.User.AuthData == nil ||
			*line.User.AuthData == "" {
			continue // skip email-auth users
		}

		if dryRun {
			continue
		}

		if appErr := a.preCreateSSOUser(rctx, line.User); appErr != nil {
			rctx.Logger().Warn("preCreateSSOUsers: failed to pre-create SSO user; main pass will handle it",
				mlog.String("username", *line.User.Username),
				mlog.String("auth_service", *line.User.AuthService),
				mlog.Err(appErr))
		}
	}
	return lineNumber
}

// preCreateSSOUser ensures a single SSO user exists on the dest with their
// auth_data set. It tries auth_data first, then username, then creates fresh.
// Errors are non-fatal — the main import pass will handle unresolved users.
func (a *App) preCreateSSOUser(rctx request.CTX, data *imports.UserImportData) *model.AppError {
	// Already exists by auth_data — nothing to do.
	if _, nErr := a.Srv().Store().User().GetByAuth(data.AuthData, *data.AuthService); nErr == nil {
		return nil
	}

	// Exists by username — attach auth_data only if the account has no existing
	// SSO provider, to avoid overwriting a different auth_service on the destination.
	if existing, nErr := a.Srv().Store().User().GetByUsername(*data.Username); nErr == nil {
		if existing.AuthService != "" && existing.AuthService != *data.AuthService {
			// Account already belongs to a different SSO provider; leave it alone and
			// let the main import pass handle the conflict.
			return nil
		}
		if _, uErr := a.Srv().Store().User().UpdateAuthData(existing.Id, *data.AuthService, data.AuthData, existing.Email, false); uErr != nil {
			return model.NewAppError("preCreateSSOUser", "app.user.update_auth_data.app_error", nil, "", http.StatusInternalServerError).Wrap(uErr)
		}
		return nil
	}

	// Create a minimal user record — main pass fills in profile, teams, prefs.
	newUser := &model.User{
		Username:    *data.Username,
		Email:       *data.Email,
		AuthService: *data.AuthService,
		AuthData:    data.AuthData,
		Roles:       model.SystemUserRoleId,
	}
	newUser.MakeNonNil()
	newUser.SetDefaultNotifications()

	if _, err := a.ch.srv.userService.CreateUser(rctx, newUser, users.UserCreateOptions{FromImport: true}); err != nil {
		return model.NewAppError("preCreateSSOUser", "app.user.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
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
