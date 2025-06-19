// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"image"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/docextractor"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"github.com/pkg/errors"
)

const (
	imageThumbnailWidth        = 120
	imageThumbnailHeight       = 100
	imagePreviewWidth          = 1920
	miniPreviewImageWidth      = 16
	miniPreviewImageHeight     = 16
	jpegEncQuality             = 90
	maxUploadInitialBufferSize = 1024 * 1024 // 1MB
	maxContentExtractionSize   = 1024 * 1024 // 1MB
)

func (a *App) FileBackend() filestore.FileBackend {
	return a.ch.filestore
}

func (a *App) ExportFileBackend() filestore.FileBackend {
	return a.ch.exportFilestore
}

func (a *App) CheckMandatoryS3Fields(settings *model.FileSettings) *model.AppError {
	var fileBackendSettings filestore.FileBackendSettings
	if a.License().IsCloud() && a.Config().FeatureFlags.CloudDedicatedExportUI && a.Config().FileSettings.DedicatedExportStore != nil && *a.Config().FileSettings.DedicatedExportStore {
		fileBackendSettings = filestore.NewExportFileBackendSettingsFromConfig(settings, false, false)
	} else {
		fileBackendSettings = filestore.NewFileBackendSettingsFromConfig(settings, false, false)
	}

	err := fileBackendSettings.CheckMandatoryS3Fields()
	if err != nil {
		return model.NewAppError("CheckMandatoryS3Fields", "api.admin.test_s3.missing_s3_bucket", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return nil
}

func connectionTestErrorToAppError(connTestErr error) *model.AppError {
	switch err := connTestErr.(type) {
	case *filestore.S3FileBackendAuthError:
		return model.NewAppError("TestConnection", "api.file.test_connection_s3_auth.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	case *filestore.S3FileBackendNoBucketError:
		return model.NewAppError("TestConnection", "api.file.test_connection_s3_bucket_does_not_exist.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	default:
		return model.NewAppError("TestConnection", "api.file.test_connection.app_error", nil, "", http.StatusInternalServerError).Wrap(connTestErr)
	}
}

func (a *App) TestFileStoreConnection() *model.AppError {
	nErr := a.FileBackend().TestConnection()
	if nErr != nil {
		return connectionTestErrorToAppError(nErr)
	}
	return nil
}

func (a *App) TestFileStoreConnectionWithConfig(cfg *model.FileSettings) *model.AppError {
	license := a.Srv().License()
	insecure := a.Config().ServiceSettings.EnableInsecureOutgoingConnections
	var backend filestore.FileBackend
	var err error
	complianceEnabled := license != nil && *license.Features.Compliance
	if license.IsCloud() && a.Config().FeatureFlags.CloudDedicatedExportUI && a.Config().FileSettings.DedicatedExportStore != nil && *a.Config().FileSettings.DedicatedExportStore {
		allowInsecure := a.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *a.Config().ServiceSettings.EnableInsecureOutgoingConnections
		backend, err = filestore.NewFileBackend(filestore.NewExportFileBackendSettingsFromConfig(cfg, complianceEnabled && license.IsCloud(), allowInsecure))
	} else {
		backend, err = filestore.NewFileBackend(filestore.NewFileBackendSettingsFromConfig(cfg, complianceEnabled, insecure != nil && *insecure))
	}
	if err != nil {
		return model.NewAppError("FileAttachmentBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	nErr := backend.TestConnection()
	if nErr != nil {
		return connectionTestErrorToAppError(nErr)
	}
	return nil
}

func (a *App) ReadFile(path string) ([]byte, *model.AppError) {
	return a.ch.srv.ReadFile(path)
}

func fileReader(backend filestore.FileBackend, path string) (filestore.ReadCloseSeeker, *model.AppError) {
	result, nErr := backend.Reader(path)
	if nErr != nil {
		return nil, model.NewAppError("FileReader", "api.file.file_reader.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func zipReader(backend filestore.FileBackend, path string, deflate bool) (io.ReadCloser, *model.AppError) {
	result, err := backend.ZipReader(path, deflate)
	if err != nil {
		return nil, model.NewAppError("ZipReader", "api.file.zip_file_reader.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}

func (s *Server) fileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return fileReader(s.FileBackend(), path)
}

func (s *Server) zipReader(path string, deflate bool) (io.ReadCloser, *model.AppError) {
	return zipReader(s.FileBackend(), path, deflate)
}

func (s *Server) exportFileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return fileReader(s.ExportFileBackend(), path)
}

func (s *Server) exportZipReader(path string, deflate bool) (io.ReadCloser, *model.AppError) {
	return zipReader(s.ExportFileBackend(), path, deflate)
}

// FileReader returns a ReadCloseSeeker for path from the FileBackend.
//
// The caller is responsible for closing the returned ReadCloseSeeker.
func (a *App) FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return a.Srv().fileReader(path)
}

// ZipReader returns a ReadCloser for path. If deflate is true, the zip will use compression.
//
// The caller is responsible for closing the returned ReadCloser.
func (a *App) ZipReader(path string, deflate bool) (io.ReadCloser, *model.AppError) {
	return a.Srv().zipReader(path, deflate)
}

// ExportFileReader returns a ReadCloseSeeker for path from the ExportFileBackend.
//
// The caller is responsible for closing the returned ReadCloseSeeker.
func (a *App) ExportFileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return a.Srv().exportFileReader(path)
}

// ExportZipReader returns a ReadCloser for path from the ExportFileBackend.
// If deflate is true, the zip will use compression.
//
// The caller is responsible for closing the returned ReadCloser.
func (a *App) ExportZipReader(path string, deflate bool) (io.ReadCloser, *model.AppError) {
	return a.Srv().exportZipReader(path, deflate)
}

func (a *App) FileExists(path string) (bool, *model.AppError) {
	return a.Srv().fileExists(path)
}

func (a *App) ExportFileExists(path string) (bool, *model.AppError) {
	return a.Srv().exportFileExists(path)
}

func (s *Server) fileExists(path string) (bool, *model.AppError) {
	return fileExists(s.FileBackend(), path)
}

func fileExists(backend filestore.FileBackend, path string) (bool, *model.AppError) {
	result, nErr := backend.FileExists(path)
	if nErr != nil {
		return false, model.NewAppError("FileExists", "api.file.file_exists.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func (s *Server) exportFileExists(path string) (bool, *model.AppError) {
	return fileExists(s.ExportFileBackend(), path)
}

func (a *App) FileSize(path string) (int64, *model.AppError) {
	size, nErr := a.FileBackend().FileSize(path)
	if nErr != nil {
		return 0, model.NewAppError("FileSize", "api.file.file_size.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return size, nil
}

func fileModTime(backend filestore.FileBackend, path string) (time.Time, *model.AppError) {
	modTime, nErr := backend.FileModTime(path)
	if nErr != nil {
		return time.Time{}, model.NewAppError("FileModTime", "api.file.file_mod_time.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return modTime, nil
}

func (a *App) FileModTime(path string) (time.Time, *model.AppError) {
	return fileModTime(a.FileBackend(), path)
}

func (a *App) ExportFileModTime(path string) (time.Time, *model.AppError) {
	return fileModTime(a.ExportFileBackend(), path)
}

func (a *App) MoveFile(oldPath, newPath string) *model.AppError {
	nErr := a.FileBackend().MoveFile(oldPath, newPath)
	if nErr != nil {
		return model.NewAppError("MoveFile", "api.file.move_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return nil
}

func (a *App) WriteFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError) {
	return a.Srv().writeFileContext(ctx, fr, path)
}

func (a *App) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	return a.Srv().writeFile(fr, path)
}

func writeFile(backend filestore.FileBackend, fr io.Reader, path string) (int64, *model.AppError) {
	result, nErr := backend.WriteFile(fr, path)
	if nErr != nil {
		return result, model.NewAppError("WriteFile", "api.file.write_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func (s *Server) writeFile(fr io.Reader, path string) (int64, *model.AppError) {
	return writeFile(s.FileBackend(), fr, path)
}

func (s *Server) writeExportFile(fr io.Reader, path string) (int64, *model.AppError) {
	return writeFile(s.ExportFileBackend(), fr, path)
}

func (a *App) WriteExportFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError) {
	return a.Srv().writeExportFileContext(ctx, fr, path)
}

func (a *App) WriteExportFile(fr io.Reader, path string) (int64, *model.AppError) {
	return a.Srv().writeExportFile(fr, path)
}

func writeFileContext(ctx context.Context, backend filestore.FileBackend, fr io.Reader, path string) (int64, *model.AppError) {
	// Check if we can provide a custom context, otherwise just use the default method.
	written, err := filestore.TryWriteFileContext(ctx, backend, fr, path)
	if err != nil {
		return written, model.NewAppError("WriteFile", "api.file.write_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return written, nil
}

func (s *Server) writeFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError) {
	return writeFileContext(ctx, s.FileBackend(), fr, path)
}

func (s *Server) writeExportFileContext(ctx context.Context, fr io.Reader, path string) (int64, *model.AppError) {
	return writeFileContext(ctx, s.ExportFileBackend(), fr, path)
}

func (a *App) AppendFile(fr io.Reader, path string) (int64, *model.AppError) {
	result, nErr := a.FileBackend().AppendFile(fr, path)
	if nErr != nil {
		return result, model.NewAppError("AppendFile", "api.file.append_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func (a *App) RemoveFile(path string) *model.AppError {
	return a.Srv().removeFile(path)
}

func (a *App) RemoveExportFile(path string) *model.AppError {
	return a.Srv().removeExportFile(path)
}

func removeFile(backend filestore.FileBackend, path string) *model.AppError {
	nErr := backend.RemoveFile(path)
	if nErr != nil {
		return model.NewAppError("RemoveFile", "api.file.remove_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return nil
}

func (s *Server) removeFile(path string) *model.AppError {
	return removeFile(s.FileBackend(), path)
}

func (s *Server) removeExportFile(path string) *model.AppError {
	return removeFile(s.ExportFileBackend(), path)
}

func (a *App) ListDirectory(path string) ([]string, *model.AppError) {
	return a.Srv().listDirectory(path, false)
}

func (a *App) ListExportDirectory(path string) ([]string, *model.AppError) {
	return a.Srv().listExportDirectory(path, false)
}

func (a *App) ListDirectoryRecursively(path string) ([]string, *model.AppError) {
	return a.Srv().listDirectory(path, true)
}

func (s *Server) listDirectory(path string, recursion bool) ([]string, *model.AppError) {
	return listDirectory(s.FileBackend(), path, recursion)
}

func listDirectory(backend filestore.FileBackend, path string, recursion bool) ([]string, *model.AppError) {
	var paths []string
	var nErr error

	if recursion {
		paths, nErr = backend.ListDirectoryRecursively(path)
	} else {
		paths, nErr = backend.ListDirectory(path)
	}

	if nErr != nil {
		return nil, model.NewAppError("ListExportDirectory", "api.file.list_directory.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return paths, nil
}

func (s *Server) listExportDirectory(path string, recursion bool) ([]string, *model.AppError) {
	return listDirectory(s.ExportFileBackend(), path, recursion)
}

func (a *App) RemoveDirectory(path string) *model.AppError {
	nErr := a.FileBackend().RemoveDirectory(path)
	if nErr != nil {
		return model.NewAppError("RemoveDirectory", "api.file.remove_directory.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return nil
}

func (a *App) getInfoForFilename(rctx request.CTX, post *model.Post, teamID, channelID, userID, oldId, filename string) *model.FileInfo {
	name, _ := url.QueryUnescape(filename)
	pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamID, channelID, userID, oldId)
	path := pathPrefix + name

	// Open the file and populate the fields of the FileInfo
	data, err := a.ReadFile(path)
	if err != nil {
		rctx.Logger().Error(
			"File not found when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("filename", filename),
			mlog.String("path", path),
			mlog.Err(err),
		)
		return nil
	}

	info, err := getInfoForBytes(name, bytes.NewReader(data), len(data))
	if err != nil {
		rctx.Logger().Warn(
			"Unable to fully decode file info when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("filename", filename),
			mlog.Err(err),
		)
	}

	// Generate a new ID because with the old system, you could very rarely get multiple posts referencing the same file
	info.Id = model.NewId()
	info.CreatorId = post.UserId
	info.PostId = post.Id
	info.ChannelId = post.ChannelId
	info.CreateAt = post.CreateAt
	info.UpdateAt = post.UpdateAt
	info.Path = path

	if info.IsImage() && !info.IsSvg() {
		nameWithoutExtension := name[:strings.LastIndex(name, ".")]
		info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview." + getFileExtFromMimeType(info.MimeType)
		info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb." + getFileExtFromMimeType(info.MimeType)
	}

	return info
}

func (a *App) findTeamIdForFilename(rctx request.CTX, post *model.Post, id, filename string) string {
	name, _ := url.QueryUnescape(filename)

	// This post is in a direct channel so we need to figure out what team the files are stored under.
	teams, err := a.Srv().Store().Team().GetTeamsByUserId(post.UserId)
	if err != nil {
		rctx.Logger().Error("Unable to get teams when migrating post to use FileInfo", mlog.Err(err), mlog.String("post_id", post.Id))
		return ""
	}

	if len(teams) == 1 {
		// The user has only one team so the post must've been sent from it
		return teams[0].Id
	}

	for _, team := range teams {
		path := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", team.Id, post.ChannelId, post.UserId, id, name)
		if ok, err := a.FileExists(path); ok && err == nil {
			// Found the team that this file was posted from
			return team.Id
		}
	}

	return ""
}

var (
	fileMigrationLock   sync.Mutex
	oldFilenameMatchExp = regexp.MustCompile(`^\/([a-z\d]{26})\/([a-z\d]{26})\/([a-z\d]{26})\/([^\/]+)$`)
)

// Parse the path from the Filename of the form /{channelID}/{userID}/{uid}/{nameWithExtension}
func parseOldFilenames(rctx request.CTX, filenames []string, channelID, userID string) [][]string {
	parsed := [][]string{}
	for _, filename := range filenames {
		matches := oldFilenameMatchExp.FindStringSubmatch(filename)
		if len(matches) != 5 {
			rctx.Logger().Error("Failed to parse old Filename", mlog.String("filename", filename))
			continue
		}
		if matches[1] != channelID {
			rctx.Logger().Error("ChannelId in Filename does not match", mlog.String("channel_id", channelID), mlog.String("matched", matches[1]))
		} else if matches[2] != userID {
			rctx.Logger().Error("UserId in Filename does not match", mlog.String("user_id", userID), mlog.String("matched", matches[2]))
		} else {
			parsed = append(parsed, matches[1:])
		}
	}
	return parsed
}

// MigrateFilenamesToFileInfos creates and stores FileInfos for a post created before the FileInfos table existed.
func (a *App) MigrateFilenamesToFileInfos(rctx request.CTX, post *model.Post) []*model.FileInfo {
	if len(post.Filenames) == 0 {
		rctx.Logger().Warn("Unable to migrate post to use FileInfos with an empty Filenames field", mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	channel, errCh := a.Srv().Store().Channel().Get(post.ChannelId, true)
	// There's a weird bug that rarely happens where a post ends up with duplicate Filenames so remove those
	filenames := utils.RemoveDuplicatesFromStringArray(post.Filenames)
	if errCh != nil {
		rctx.Logger().Error(
			"Unable to get channel when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(errCh),
		)
		return []*model.FileInfo{}
	}

	// Parse and validate filenames before further processing
	parsedFilenames := parseOldFilenames(rctx, filenames, post.ChannelId, post.UserId)

	if len(parsedFilenames) == 0 {
		rctx.Logger().Error("Unable to parse filenames")
		return []*model.FileInfo{}
	}

	// Find the team that was used to make this post since its part of the file path that isn't saved in the Filename
	var teamID string
	if channel.TeamId == "" {
		// This post was made in a cross-team DM channel, so we need to find where its files were saved
		teamID = a.findTeamIdForFilename(rctx, post, parsedFilenames[0][2], parsedFilenames[0][3])
	} else {
		teamID = channel.TeamId
	}

	// Create FileInfo objects for this post
	infos := make([]*model.FileInfo, 0, len(filenames))
	if teamID == "" {
		rctx.Logger().Error(
			"Unable to find team id for files when migrating post to use FileInfos",
			mlog.String("filenames", strings.Join(filenames, ",")),
			mlog.String("post_id", post.Id),
		)
	} else {
		for _, parsed := range parsedFilenames {
			info := a.getInfoForFilename(rctx, post, teamID, parsed[0], parsed[1], parsed[2], parsed[3])
			if info == nil {
				continue
			}

			infos = append(infos, info)
		}
	}

	// Lock to prevent only one migration thread from trying to update the post at once, preventing duplicate FileInfos from being created
	fileMigrationLock.Lock()
	defer fileMigrationLock.Unlock()

	result, nErr := a.Srv().Store().Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", a.Config().GetSanitizeOptions())
	if nErr != nil {
		rctx.Logger().Error("Unable to get post when migrating post to use FileInfos", mlog.Err(nErr), mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	if newPost := result.Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		var fileInfos []*model.FileInfo
		fileInfos, nErr = a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, false)
		if nErr != nil {
			rctx.Logger().Error("Unable to get FileInfos for migrated post", mlog.Err(nErr), mlog.String("post_id", post.Id))
			return []*model.FileInfo{}
		}

		rctx.Logger().Debug("Post already migrated to use FileInfos", mlog.String("post_id", post.Id))
		return fileInfos
	}

	rctx.Logger().Debug("Migrating post to use FileInfos", mlog.String("post_id", post.Id))

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIDs := make([]string, 0, len(filenames))
	for _, info := range infos {
		if _, nErr = a.Srv().Store().FileInfo().Save(rctx, info); nErr != nil {
			rctx.Logger().Error(
				"Unable to save file info when migrating post to use FileInfos",
				mlog.String("post_id", post.Id),
				mlog.String("file_info_id", info.Id),
				mlog.String("file_info_path", info.Path),
				mlog.Err(nErr),
			)
			continue
		}

		savedInfos = append(savedInfos, info)
		fileIDs = append(fileIDs, info.Id)
	}

	// Copy and save the updated post
	newPost := post.Clone()

	newPost.Filenames = []string{}
	newPost.FileIds = fileIDs

	// Update Posts to clear Filenames and set FileIds
	if _, nErr = a.Srv().Store().Post().Update(rctx, newPost, post); nErr != nil {
		rctx.Logger().Error(
			"Unable to save migrated post when migrating to use FileInfos",
			mlog.String("new_file_ids", strings.Join(newPost.FileIds, ",")),
			mlog.String("old_filenames", strings.Join(post.Filenames, ",")),
			mlog.String("post_id", post.Id),
			mlog.Err(nErr),
		)
		return []*model.FileInfo{}
	}
	return savedInfos
}

func (a *App) GeneratePublicLink(siteURL string, info *model.FileInfo) string {
	hash := GeneratePublicLinkHash(info.Id, *a.Config().FileSettings.PublicLinkSalt)
	return fmt.Sprintf("%s/files/%v/public?h=%s", siteURL, info.Id, hash)
}

func GeneratePublicLinkHash(fileID, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(salt))
	hash.Write([]byte(fileID))

	return base64.RawURLEncoding.EncodeToString(hash.Sum(nil))
}

// UploadFile uploads a single file in form of a completely constructed byte array for a channel.
func (a *App) UploadFile(c request.CTX, data []byte, channelID string, filename string) (*model.FileInfo, *model.AppError) {
	return a.UploadFileForUserAndTeam(c, data, channelID, filename, "", "")
}

func (a *App) UploadFileForUserAndTeam(c request.CTX, data []byte, channelID string, filename string, rawUserId string, rawTeamId string) (*model.FileInfo, *model.AppError) {
	_, err := a.GetChannel(c, channelID)
	if err != nil && channelID != "" {
		return nil, model.NewAppError("UploadFile", "api.file.upload_file.incorrect_channelId.app_error",
			map[string]any{"channelId": channelID}, "", http.StatusBadRequest)
	}

	userId := rawUserId
	if userId == "" {
		userId = "nouser"
	}

	teamId := rawTeamId
	if teamId == "" {
		teamId = "noteam"
	}

	info, _, appError := a.DoUploadFileExpectModification(c, time.Now(), teamId, channelID, userId, filename, data, true)
	if appError != nil {
		return nil, appError
	}

	if info.PreviewPath != "" || info.ThumbnailPath != "" {
		previewPathList := []string{info.PreviewPath}
		thumbnailPathList := []string{info.ThumbnailPath}
		imageDataList := [][]byte{data}

		a.HandleImages(c, previewPathList, thumbnailPathList, imageDataList)
	}

	return info, nil
}

func (a *App) DoUploadFile(c request.CTX, now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte, extractContent bool) (*model.FileInfo, *model.AppError) {
	info, _, err := a.DoUploadFileExpectModification(c, now, rawTeamId, rawChannelId, rawUserId, rawFilename, data, extractContent)
	return info, err
}

func UploadFileSetTeamId(teamID string) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.TeamId = filepath.Base(teamID)
	}
}

func UploadFileSetUserId(userID string) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.UserId = filepath.Base(userID)
	}
}

func UploadFileSetTimestamp(timestamp time.Time) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.Timestamp = timestamp
	}
}

func UploadFileSetContentLength(contentLength int64) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.ContentLength = contentLength
	}
}

func UploadFileSetClientId(clientId string) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.ClientId = clientId
	}
}

func UploadFileSetRaw() func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.Raw = true
	}
}

func UploadFileSetExtractContent(value bool) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.ExtractContent = value
	}
}

type UploadFileTask struct {
	Logger mlog.LoggerIFace

	// File name.
	Name string

	ChannelId string
	TeamId    string
	UserId    string

	// Time stamp to use when creating the file.
	Timestamp time.Time

	// The value of the Content-Length http header, when available.
	ContentLength int64

	// The file data stream.
	Input io.Reader

	// An optional, client-assigned Id field.
	ClientId string

	// If Raw, do not execute special processing for images, just upload
	// the file.  Plugins are still invoked.
	Raw bool

	// Whether or not to extract file attachments content
	// This is used by the bulk import process.
	ExtractContent bool

	//=============================================================
	// Internal state

	buf          *bytes.Buffer
	limit        int64
	limitedInput io.Reader
	teeInput     io.Reader
	fileinfo     *model.FileInfo
	maxFileSize  int64
	maxImageRes  int64

	// Cached image data that (may) get initialized in preprocessImage and
	// is used in postprocessImage
	decoded          image.Image
	imageType        string
	imageOrientation int

	// Testing: overridable dependency functions
	pluginsEnvironment *plugin.Environment
	writeFile          func(io.Reader, string) (int64, *model.AppError)
	saveToDatabase     func(request.CTX, *model.FileInfo) (*model.FileInfo, error)

	imgDecoder *imaging.Decoder
	imgEncoder *imaging.Encoder
}

func (t *UploadFileTask) init(a *App) {
	t.buf = &bytes.Buffer{}
	if t.ContentLength > 0 {
		t.limit = t.ContentLength
	} else {
		t.limit = t.maxFileSize
	}

	if t.ContentLength > 0 && t.ContentLength < maxUploadInitialBufferSize {
		t.buf.Grow(int(t.ContentLength))
	} else {
		t.buf.Grow(maxUploadInitialBufferSize)
	}

	t.fileinfo = model.NewInfo(filepath.Base(t.Name))
	t.fileinfo.Id = model.NewId()
	t.fileinfo.CreatorId = t.UserId
	t.fileinfo.CreateAt = t.Timestamp.UnixNano() / int64(time.Millisecond)
	t.fileinfo.Path = t.pathPrefix() + t.Name
	t.fileinfo.ChannelId = t.ChannelId

	t.limitedInput = &io.LimitedReader{
		R: t.Input,
		N: t.limit + 1,
	}
	t.teeInput = io.TeeReader(t.limitedInput, t.buf)

	t.pluginsEnvironment = a.GetPluginsEnvironment()
	t.writeFile = a.WriteFile
	t.saveToDatabase = a.Srv().Store().FileInfo().Save
}

// UploadFileX uploads a single file as specified in t. It applies the upload
// constraints, executes plugins and image processing logic as needed. It
// returns a filled-out FileInfo and an optional error. A plugin may reject the
// upload, returning a rejection error. In this case FileInfo would have
// contained the last "good" FileInfo before the execution of that plugin.
func (a *App) UploadFileX(c request.CTX, channelID, name string, input io.Reader,
	opts ...func(*UploadFileTask),
) (*model.FileInfo, *model.AppError) {
	t := &UploadFileTask{
		Logger:         c.Logger(),
		ChannelId:      filepath.Base(channelID),
		Name:           filepath.Base(name),
		Input:          input,
		maxFileSize:    *a.Config().FileSettings.MaxFileSize,
		maxImageRes:    *a.Config().FileSettings.MaxImageResolution,
		imgDecoder:     a.ch.imgDecoder,
		imgEncoder:     a.ch.imgEncoder,
		ExtractContent: true,
	}
	for _, o := range opts {
		o(t)
	}

	c = c.WithLogger(c.Logger().With(
		mlog.String("file_name", name),
		mlog.String("channel_id", channelID),
		mlog.String("user_id", t.UserId),
	))

	if *a.Config().FileSettings.DriverName == "" {
		return nil, t.newAppError("api.file.upload_file.storage.app_error", http.StatusNotImplemented)
	}
	if t.ContentLength > t.maxFileSize {
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
	}

	t.init(a)

	var aerr *model.AppError
	if !t.Raw && t.fileinfo.IsImage() {
		aerr = t.preprocessImage()
		if aerr != nil {
			return t.fileinfo, aerr
		}
	}

	written, aerr := t.writeFile(io.MultiReader(t.buf, t.limitedInput), t.fileinfo.Path)
	if aerr != nil {
		return nil, aerr
	}

	if written > t.maxFileSize {
		if fileErr := a.RemoveFile(t.fileinfo.Path); fileErr != nil {
			c.Logger().Error("Failed to remove file", mlog.Err(fileErr))
		}
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
	}

	t.fileinfo.Size = written

	file, aerr := a.FileReader(t.fileinfo.Path)
	if aerr != nil {
		return nil, aerr
	}
	defer file.Close()

	aerr = a.runPluginsHook(c, t.fileinfo, file)
	if aerr != nil {
		return nil, aerr
	}

	if !t.Raw && t.fileinfo.IsImage() {
		file, aerr = a.FileReader(t.fileinfo.Path)
		if aerr != nil {
			return nil, aerr
		}
		defer file.Close()
		t.postprocessImage(file)
	}

	if _, err := t.saveToDatabase(c, t.fileinfo); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UploadFileX", "app.file_info.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if *a.Config().FileSettings.ExtractContent && t.ExtractContent {
		infoCopy := *t.fileinfo
		a.Srv().GoBuffered(func() {
			err := a.ExtractContentFromFileInfo(c, &infoCopy)
			if err != nil {
				c.Logger().Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
			}
		})
	}

	return t.fileinfo, nil
}

func (t *UploadFileTask) preprocessImage() *model.AppError {
	// If SVG, attempt to extract dimensions and then return
	if t.fileinfo.IsSvg() {
		svgInfo, err := imaging.ParseSVG(t.teeInput)
		if err != nil {
			t.Logger.Warn("Failed to parse SVG", mlog.Err(err))
		}
		if svgInfo.Width > 0 && svgInfo.Height > 0 {
			t.fileinfo.Width = svgInfo.Width
			t.fileinfo.Height = svgInfo.Height
		}
		t.fileinfo.HasPreviewImage = false
		return nil
	}

	// If we fail to decode, return "as is".
	cfg, format, err := t.imgDecoder.DecodeConfig(t.teeInput)
	if err != nil {
		return nil
	}
	t.fileinfo.Width = cfg.Width
	t.fileinfo.Height = cfg.Height

	if err = checkImageResolutionLimit(cfg.Width, cfg.Height, t.maxImageRes); err != nil {
		return t.newAppError("api.file.upload_file.large_image_detailed.app_error", http.StatusBadRequest).Wrap(err)
	}

	t.fileinfo.HasPreviewImage = true
	nameWithoutExtension := t.Name[:strings.LastIndex(t.Name, ".")]
	t.fileinfo.PreviewPath = t.pathPrefix() + nameWithoutExtension + "_preview." + getFileExtFromMimeType(t.fileinfo.MimeType)
	t.fileinfo.ThumbnailPath = t.pathPrefix() + nameWithoutExtension + "_thumb." + getFileExtFromMimeType(t.fileinfo.MimeType)

	// check the image orientation with goexif; consume the bytes we
	// already have first, then keep Tee-ing from input.
	// TODO: try to reuse exif's .Raw buffer rather than Tee-ing
	if t.imageOrientation, err = imaging.GetImageOrientation(io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput), format); err == nil &&
		(t.imageOrientation == imaging.RotatedCWMirrored ||
			t.imageOrientation == imaging.RotatedCCW ||
			t.imageOrientation == imaging.RotatedCCWMirrored ||
			t.imageOrientation == imaging.RotatedCW) {
		t.fileinfo.Width, t.fileinfo.Height = t.fileinfo.Height, t.fileinfo.Width
	} else if err != nil {
		t.Logger.Warn("Failed to get image orientation", mlog.Err(err))
	}

	// For animated GIFs disable the preview; since we have to Decode gifs
	// anyway, cache the decoded image for later.
	if t.fileinfo.MimeType == "image/gif" {
		image, format, err := t.imgDecoder.Decode(io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput))
		if err == nil && image != nil {
			t.fileinfo.HasPreviewImage = false
			t.decoded = image
			t.imageType = format
		}
	}

	return nil
}

func (t *UploadFileTask) postprocessImage(file io.Reader) {
	// don't try to process SVG files
	if t.fileinfo.IsSvg() {
		return
	}

	decoded, imgType := t.decoded, t.imageType
	if decoded == nil {
		var err error
		var release func()
		decoded, imgType, release, err = t.imgDecoder.DecodeMemBounded(file)
		if err != nil {
			t.Logger.Error("Unable to decode image", mlog.Err(err))
			return
		}
		defer release()
	}

	decoded = imaging.MakeImageUpright(decoded, t.imageOrientation)
	if decoded == nil {
		return
	}

	writeImage := func(img image.Image, path string) {
		r, w := io.Pipe()
		go func() {
			var err error
			// It's okay to access imgType in a separate goroutine,
			// because imgType is only written once and never written again.
			if imgType == "png" {
				err = t.imgEncoder.EncodePNG(w, img)
			} else {
				err = t.imgEncoder.EncodeJPEG(w, img, jpegEncQuality)
			}
			if err != nil {
				t.Logger.Error("Unable to encode image as jpeg", mlog.String("path", path), mlog.Err(err))
				w.CloseWithError(err)
			} else {
				w.Close()
			}
		}()
		_, aerr := t.writeFile(r, path)
		if aerr != nil {
			t.Logger.Error("Unable to upload", mlog.String("path", path), mlog.Err(aerr))
			r.CloseWithError(aerr) // always returns nil
			return
		}
	}

	var wg sync.WaitGroup
	wg.Add(3)
	// Generating thumbnail and preview regardless of HasPreviewImage value.
	// This is needed on mobile in case of animated GIFs.
	go func() {
		defer wg.Done()
		writeImage(imaging.GenerateThumbnail(decoded, imageThumbnailWidth, imageThumbnailHeight), t.fileinfo.ThumbnailPath)
	}()

	go func() {
		defer wg.Done()
		writeImage(imaging.GeneratePreview(decoded, imagePreviewWidth), t.fileinfo.PreviewPath)
	}()

	go func() {
		defer wg.Done()
		if t.fileinfo.MiniPreview == nil {
			if miniPreview, err := imaging.GenerateMiniPreviewImage(decoded,
				miniPreviewImageWidth, miniPreviewImageHeight, jpegEncQuality); err != nil {
				t.Logger.Info("Unable to generate mini preview image", mlog.Err(err))
			} else {
				t.fileinfo.MiniPreview = &miniPreview
			}
		}
	}()
	wg.Wait()
}

func (t UploadFileTask) pathPrefix() string {
	if t.UserId == model.BookmarkFileOwner {
		return model.BookmarkFileOwner +
			"/teams/" + t.TeamId +
			"/channels/" + t.ChannelId +
			"/" + t.fileinfo.Id + "/"
	}
	return t.Timestamp.Format("20060102") +
		"/teams/" + t.TeamId +
		"/channels/" + t.ChannelId +
		"/users/" + t.UserId +
		"/" + t.fileinfo.Id + "/"
}

func (t UploadFileTask) newAppError(id string, httpStatus int, extra ...any) *model.AppError {
	params := map[string]any{
		"Name":          t.Name,
		"Filename":      t.Name,
		"ChannelId":     t.ChannelId,
		"TeamId":        t.TeamId,
		"UserId":        t.UserId,
		"ContentLength": t.ContentLength,
		"ClientId":      t.ClientId,
	}
	if t.fileinfo != nil {
		params["Width"] = t.fileinfo.Width
		params["Height"] = t.fileinfo.Height
	}
	for i := 0; i+1 < len(extra); i += 2 {
		params[fmt.Sprintf("%v", extra[i])] = extra[i+1]
	}

	return model.NewAppError("uploadFileTask", id, params, "", httpStatus)
}

func (a *App) DoUploadFileExpectModification(c request.CTX, now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte, extractContent bool) (*model.FileInfo, []byte, *model.AppError) {
	filename := filepath.Base(rawFilename)
	teamID := filepath.Base(rawTeamId)
	channelID := filepath.Base(rawChannelId)
	userID := filepath.Base(rawUserId)

	info, err := getInfoForBytes(filename, bytes.NewReader(data), len(data))
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, data, err
	}

	if orientation, err := imaging.GetImageOrientation(bytes.NewReader(data), info.MimeType); err == nil &&
		(orientation == imaging.RotatedCWMirrored ||
			orientation == imaging.RotatedCCW ||
			orientation == imaging.RotatedCCWMirrored ||
			orientation == imaging.RotatedCW) {
		info.Width, info.Height = info.Height, info.Width
	} else if err != nil {
		c.Logger().Warn("Failed to get image orientation", mlog.Err(err))
	}

	info.Id = model.NewId()
	info.CreatorId = userID
	info.CreateAt = now.UnixNano() / int64(time.Millisecond)

	pathPrefix := now.Format("20060102") + "/teams/" + teamID + "/channels/" + channelID + "/users/" + userID + "/" + info.Id + "/"
	if userID == model.BookmarkFileOwner {
		pathPrefix = model.BookmarkFileOwner + "/teams/" + teamID + "/channels/" + channelID + "/" + info.Id + "/"
	}
	info.Path = pathPrefix + filename

	if info.IsImage() && !info.IsSvg() {
		if limitErr := checkImageResolutionLimit(info.Width, info.Height, *a.Config().FileSettings.MaxImageResolution); limitErr != nil {
			err := model.NewAppError("uploadFile", "api.file.upload_file.large_image.app_error", map[string]any{"Filename": filename}, "", http.StatusBadRequest).Wrap(limitErr)
			return nil, data, err
		}

		nameWithoutExtension := filename[:strings.LastIndex(filename, ".")]
		info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview." + getFileExtFromMimeType(info.MimeType)
		info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb." + getFileExtFromMimeType(info.MimeType)
	}

	var rejectionError *model.AppError
	pluginContext := pluginContext(c)
	a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		var newBytes bytes.Buffer
		replacementInfo, rejectionReason := hooks.FileWillBeUploaded(pluginContext, info, bytes.NewReader(data), &newBytes)
		if rejectionReason != "" {
			rejectionError = model.NewAppError("DoUploadFile", "File rejected by plugin. "+rejectionReason, nil, "", http.StatusBadRequest)
			return false
		}
		if replacementInfo != nil {
			info = replacementInfo
		}
		if newBytes.Len() != 0 {
			data = newBytes.Bytes()
			info.Size = int64(len(data))
		}

		return true
	}, plugin.FileWillBeUploadedID)
	if rejectionError != nil {
		return nil, data, rejectionError
	}

	if _, err := a.WriteFile(bytes.NewReader(data), info.Path); err != nil {
		return nil, data, err
	}

	if _, err := a.Srv().Store().FileInfo().Save(c, info); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, data, appErr
		default:
			return nil, data, model.NewAppError("DoUploadFileExpectModification", "app.file_info.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// The extra boolean extractContent is used to turn off extraction
	// during the import process. It is unnecessary overhead during the import,
	// and something we can do without.
	if *a.Config().FileSettings.ExtractContent && extractContent {
		infoCopy := *info
		a.Srv().GoBuffered(func() {
			err := a.ExtractContentFromFileInfo(c, &infoCopy)
			if err != nil {
				c.Logger().Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
			}
		})
	}

	return info, data, nil
}

func (a *App) HandleImages(rctx request.CTX, previewPathList []string, thumbnailPathList []string, fileData [][]byte) {
	wg := new(sync.WaitGroup)

	for i := range fileData {
		img, imgType, release, err := prepareImage(rctx, a.ch.imgDecoder, bytes.NewReader(fileData[i]))
		if err != nil {
			rctx.Logger().Debug("Failed to prepare image", mlog.Err(err))
			continue
		}
		wg.Add(2)
		go func(img image.Image, imgType, path string) {
			defer wg.Done()
			a.generateThumbnailImage(rctx, img, imgType, path)
		}(img, imgType, thumbnailPathList[i])

		go func(img image.Image, imgType, path string) {
			defer wg.Done()
			a.generatePreviewImage(rctx, img, imgType, path)
		}(img, imgType, previewPathList[i])

		wg.Wait()
		release()
	}
}

func prepareImage(rctx request.CTX, imgDecoder *imaging.Decoder, imgData io.ReadSeeker) (img image.Image, imgType string, release func(), err error) {
	// Decode image bytes into Image object
	img, imgType, release, err = imgDecoder.DecodeMemBounded(imgData)
	if err != nil {
		return nil, "", nil, fmt.Errorf("prepareImage: failed to decode image: %w", err)
	}
	if _, err = imgData.Seek(0, io.SeekStart); err != nil {
		return nil, "", nil, fmt.Errorf("prepareImage: failed to seek image data: %w", err)
	}

	// Flip the image to be upright
	orientation, err := imaging.GetImageOrientation(imgData, imgType)
	if err != nil {
		rctx.Logger().Debug("GetImageOrientation failed", mlog.Err(err))
	}
	img = imaging.MakeImageUpright(img, orientation)

	return img, imgType, release, nil
}

func (a *App) generateThumbnailImage(rctx request.CTX, img image.Image, imgType, thumbnailPath string) {
	var buf bytes.Buffer

	thumb := imaging.GenerateThumbnail(img, imageThumbnailWidth, imageThumbnailHeight)
	if imgType == "png" {
		if err := a.ch.imgEncoder.EncodePNG(&buf, thumb); err != nil {
			rctx.Logger().Error("Unable to encode image as png", mlog.String("path", thumbnailPath), mlog.Err(err))
			return
		}
	} else {
		if err := a.ch.imgEncoder.EncodeJPEG(&buf, thumb, jpegEncQuality); err != nil {
			rctx.Logger().Error("Unable to encode image as jpeg", mlog.String("path", thumbnailPath), mlog.Err(err))
			return
		}
	}

	if _, err := a.WriteFile(&buf, thumbnailPath); err != nil {
		rctx.Logger().Error("Unable to upload thumbnail", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}
}

func (a *App) generatePreviewImage(rctx request.CTX, img image.Image, imgType, previewPath string) {
	var buf bytes.Buffer

	preview := imaging.GeneratePreview(img, imagePreviewWidth)
	if imgType == "png" {
		if err := a.ch.imgEncoder.EncodePNG(&buf, preview); err != nil {
			rctx.Logger().Error("Unable to encode image as preview png", mlog.Err(err), mlog.String("path", previewPath))
			return
		}
	} else {
		if err := a.ch.imgEncoder.EncodeJPEG(&buf, preview, jpegEncQuality); err != nil {
			rctx.Logger().Error("Unable to encode image as preview jpg", mlog.Err(err), mlog.String("path", previewPath))
			return
		}
	}

	if _, err := a.WriteFile(&buf, previewPath); err != nil {
		rctx.Logger().Error("Unable to upload preview", mlog.Err(err), mlog.String("path", previewPath))
		return
	}
}

// generateMiniPreview updates mini preview if needed
// will save fileinfo with the preview added
func (a *App) generateMiniPreview(rctx request.CTX, fi *model.FileInfo) {
	if fi.IsImage() && !fi.IsSvg() && fi.MiniPreview == nil {
		file, appErr := a.FileReader(fi.Path)
		if appErr != nil {
			rctx.Logger().Debug("Error reading image file", mlog.Err(appErr))
			return
		}
		defer file.Close()
		img, _, release, err := prepareImage(rctx, a.ch.imgDecoder, file)
		if err != nil {
			rctx.Logger().Debug("generateMiniPreview: prepareImage failed", mlog.Err(err),
				mlog.String("fileinfo_id", fi.Id), mlog.String("channel_id", fi.ChannelId),
				mlog.String("creator_id", fi.CreatorId))
			return
		}
		defer release()
		var miniPreview []byte
		if miniPreview, err = imaging.GenerateMiniPreviewImage(img,
			miniPreviewImageWidth, miniPreviewImageHeight, jpegEncQuality); err != nil {
			rctx.Logger().Info("Unable to generate mini preview image", mlog.Err(err))
		} else {
			fi.MiniPreview = &miniPreview
		}
		if _, err = a.Srv().Store().FileInfo().Upsert(rctx, fi); err != nil {
			rctx.Logger().Debug("Creating mini preview failed", mlog.Err(err))
		} else {
			a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(fi.PostId, false)
		}
	}
}

func (a *App) generateMiniPreviewForInfos(rctx request.CTX, fileInfos []*model.FileInfo) {
	wg := new(sync.WaitGroup)

	wg.Add(len(fileInfos))
	for _, fileInfo := range fileInfos {
		go func(fi *model.FileInfo) {
			defer wg.Done()
			a.generateMiniPreview(rctx, fi)
		}(fileInfo)
	}
	wg.Wait()
}

func (s *Server) getFileInfo(fileID string) (*model.FileInfo, *model.AppError) {
	fileInfo, err := s.Store().FileInfo().Get(fileID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetFileInfo", "app.file_info.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetFileInfo", "app.file_info.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return fileInfo, nil
}

func (a *App) GetFileInfo(rctx request.CTX, fileID string) (*model.FileInfo, *model.AppError) {
	fileInfo, appErr := a.Srv().getFileInfo(fileID)
	if appErr != nil {
		return nil, appErr
	}

	firstInaccessibleFileTime, appErr := a.isInaccessibleFile(fileInfo)
	if appErr != nil {
		return nil, appErr
	}
	if firstInaccessibleFileTime > 0 {
		return nil, model.NewAppError("GetFileInfo", "app.file.cloud.get.app_error", nil, "", http.StatusForbidden)
	}

	a.generateMiniPreview(rctx, fileInfo)
	return fileInfo, appErr
}

func (a *App) SetFileSearchableContent(rctx request.CTX, fileID string, data string) *model.AppError {
	fileInfo, appErr := a.Srv().getFileInfo(fileID)
	if appErr != nil {
		return appErr
	}

	err := a.Srv().Store().FileInfo().SetContent(rctx, fileInfo.Id, data)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("SetFileSearchableContent", "app.file_info.set_searchable_content.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("SetFileSearchableContent", "app.file_info.set_searchable_content.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) GetFileInfos(rctx request.CTX, page, perPage int, opt *model.GetFileInfosOptions) ([]*model.FileInfo, *model.AppError) {
	fileInfos, err := a.Srv().Store().FileInfo().GetWithOptions(page, perPage, opt)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var ltErr *store.ErrLimitExceeded
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &ltErr):
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	filterOptions := filterFileOptions{}
	if opt != nil && (opt.SortBy == "" || opt.SortBy == model.FileinfoSortByCreated) {
		filterOptions.assumeSortedCreatedAt = true
	}

	fileInfos, _, appErr := a.getFilteredAccessibleFiles(fileInfos, filterOptions)
	if appErr != nil {
		return nil, appErr
	}

	a.generateMiniPreviewForInfos(rctx, fileInfos)

	return fileInfos, nil
}

func (a *App) GetFile(rctx request.CTX, fileID string) ([]byte, *model.AppError) {
	info, err := a.GetFileInfo(rctx, fileID)
	if err != nil {
		return nil, err
	}

	data, err := a.ReadFile(info.Path)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (a *App) CopyFileInfos(rctx request.CTX, userID string, fileIDs []string) ([]string, *model.AppError) {
	var newFileIds []string

	now := model.GetMillis()

	for _, fileID := range fileIDs {
		fileInfo, err := a.Srv().Store().FileInfo().Get(fileID)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
			default:
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		fileInfo.Id = model.NewId()
		fileInfo.CreatorId = userID
		fileInfo.CreateAt = now
		fileInfo.UpdateAt = now
		fileInfo.PostId = ""
		fileInfo.ChannelId = ""

		if _, err := a.Srv().Store().FileInfo().Save(rctx, fileInfo); err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		newFileIds = append(newFileIds, fileInfo.Id)
	}

	return newFileIds, nil
}

// This function zip's up all the files in fileDatas array and then saves it to the directory specified with the specified zip file name
// Ensure the zip file name ends with a .zip
func (a *App) CreateZipFileAndAddFiles(fileBackend filestore.FileBackend, fileDatas []model.FileData, zipFileName, directory string) error {
	// Create Zip File (temporarily stored on disk)
	conglomerateZipFile, err := os.Create(zipFileName)
	if err != nil {
		return fmt.Errorf("failed to create temporary zip file %q: %w", zipFileName, err)
	}
	defer os.Remove(zipFileName)

	// Create a new zip archive.
	zipFileWriter := zip.NewWriter(conglomerateZipFile)

	// Populate Zip file with File Datas array
	err = populateZipfile(zipFileWriter, fileDatas)
	if err != nil {
		return err
	}

	_, err = conglomerateZipFile.Seek(0, 0)
	if err != nil {
		return fmt.Errorf("failed to seek to beginning of zip file %q: %w", conglomerateZipFile.Name(), err)
	}
	_, err = fileBackend.WriteFile(conglomerateZipFile, path.Join(directory, zipFileName))
	if err != nil {
		return fmt.Errorf("failed to write zip file to file backend at path %s: %w", path.Join(directory, zipFileName), err)
	}

	return nil
}

// This is a implementation of Go's example of writing files to zip (with slight modification)
// https://golang.org/src/archive/zip/example_test.go
func populateZipfile(w *zip.Writer, fileDatas []model.FileData) error {
	defer w.Close()
	for _, fd := range fileDatas {
		f, err := w.CreateHeader(&zip.FileHeader{
			Name:     fd.Filename,
			Method:   zip.Deflate,
			Modified: time.Now(),
		})
		if err != nil {
			return err
		}

		_, err = f.Write(fd.Body)
		if err != nil {
			return err
		}
	}
	return nil
}

func (a *App) SearchFilesInTeamForUser(c request.CTX, terms string, userId string, teamId string, isOrSearch bool, includeDeletedChannels bool, timeZoneOffset int, page, perPage int) (*model.FileInfoList, *model.AppError) {
	paramsList := model.ParseSearchParams(strings.TrimSpace(terms), timeZoneOffset)
	includeDeleted := includeDeletedChannels && *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	if !*a.Config().ServiceSettings.EnableFileSearch {
		return nil, model.NewAppError("SearchFilesInTeamForUser", "store.sql_file_info.search.disabled", nil, fmt.Sprintf("teamId=%v userId=%v", teamId, userId), http.StatusNotImplemented)
	}

	finalParamsList := []*model.SearchParams{}

	for _, params := range paramsList {
		params.OrTerms = isOrSearch
		params.IncludeDeletedChannels = includeDeleted
		// Don't allow users to search for "*"
		if params.Terms != "*" {
			// Convert channel names to channel IDs
			params.InChannels = a.convertChannelNamesToChannelIds(c, params.InChannels, userId, teamId, includeDeletedChannels)
			params.ExcludedChannels = a.convertChannelNamesToChannelIds(c, params.ExcludedChannels, userId, teamId, includeDeletedChannels)

			// Convert usernames to user IDs
			params.FromUsers = a.convertUserNameToUserIds(c, params.FromUsers)
			params.ExcludedUsers = a.convertUserNameToUserIds(c, params.ExcludedUsers)

			finalParamsList = append(finalParamsList, params)
		}
	}

	// If the processed search params are empty, return empty search results.
	if len(finalParamsList) == 0 {
		return model.NewFileInfoList(), nil
	}

	fileInfoSearchResults, nErr := a.Srv().Store().FileInfo().Search(c, finalParamsList, userId, teamId, page, perPage)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SearchFilesInTeamForUser", "app.post.search.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return fileInfoSearchResults, a.filterInaccessibleFiles(fileInfoSearchResults, filterFileOptions{assumeSortedCreatedAt: true})
}

func (a *App) ExtractContentFromFileInfo(rctx request.CTX, fileInfo *model.FileInfo) error {
	// We don't process images.
	if fileInfo.IsImage() {
		return nil
	}

	file, aerr := a.FileReader(fileInfo.Path)
	if aerr != nil {
		return errors.Wrap(aerr, "failed to open file for extract file content")
	}
	defer file.Close()
	text, err := docextractor.Extract(rctx.Logger(), fileInfo.Name, file, docextractor.ExtractSettings{
		ArchiveRecursion: *a.Config().FileSettings.ArchiveRecursion,
	})
	if err != nil {
		return errors.Wrap(err, "failed to extract file content")
	}
	if text != "" {
		if len(text) > maxContentExtractionSize {
			text = text[0:maxContentExtractionSize]
		}
		if storeErr := a.Srv().Store().FileInfo().SetContent(rctx, fileInfo.Id, text); storeErr != nil {
			return errors.Wrap(storeErr, "failed to save the extracted file content")
		}
		reloadFileInfo, storeErr := a.Srv().Store().FileInfo().Get(fileInfo.Id)
		if storeErr != nil {
			rctx.Logger().Warn("Failed to invalidate the fileInfo cache.", mlog.Err(storeErr), mlog.String("file_info_id", fileInfo.Id))
		} else {
			a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(reloadFileInfo.PostId, false)
		}
	}
	return nil
}

// GetLastAccessibleFileTime returns CreateAt time(from cache) of the last accessible post as per the cloud limit
func (a *App) GetLastAccessibleFileTime() (int64, *model.AppError) {
	license := a.Srv().License()
	if !license.IsCloud() {
		return 0, nil
	}

	system, err := a.Srv().Store().System().GetByName(model.SystemLastAccessibleFileTime)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			// All files are accessible
			return 0, nil
		default:
			return 0, model.NewAppError("GetLastAccessibleFileTime", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	lastAccessibleFileTime, err := strconv.ParseInt(system.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("GetLastAccessibleFileTime", "common.parse_error_int64", map[string]any{"Value": system.Value}, "", http.StatusInternalServerError).Wrap(err)
	}

	return lastAccessibleFileTime, nil
}

// ComputeLastAccessibleFileTime updates cache with CreateAt time of the last accessible file as per the cloud plan's limit.
// Use GetLastAccessibleFileTime() to access the result.
func (a *App) ComputeLastAccessibleFileTime() error {
	limit, appErr := a.getCloudFilesSizeLimit()
	if appErr != nil {
		return appErr
	}

	if limit == 0 {
		// All files are accessible - we must check if a previous value was set so we can clear it
		systemValue, err := a.Srv().Store().System().GetByName(model.SystemLastAccessibleFileTime)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				// All files are already accessible
				return nil
			default:
				return model.NewAppError("ComputeLastAccessibleFileTime", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		if systemValue != nil {
			// Previous value was set, so we must clear it
			if _, err := a.Srv().Store().System().PermanentDeleteByName(model.SystemLastAccessibleFileTime); err != nil {
				return model.NewAppError("ComputeLastAccessibleFileTime", "app.system.permanent_delete_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return nil
	}

	createdAt, err := a.Srv().GetStore().FileInfo().GetUptoNSizeFileTime(limit)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("ComputeLastAccessibleFileTime", "app.last_accessible_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Update Cache
	err = a.Srv().Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: strconv.FormatInt(createdAt, 10),
	})
	if err != nil {
		return model.NewAppError("ComputeLastAccessibleFileTime", "app.system.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// getCloudFilesSizeLimit returns size in bytes
func (a *App) getCloudFilesSizeLimit() (int64, *model.AppError) {
	license := a.Srv().License()
	if license == nil || !license.IsCloud() {
		return 0, nil
	}

	// limits is in bits
	limits, err := a.Cloud().GetCloudLimits("")
	if err != nil {
		return 0, model.NewAppError("getCloudFilesSizeLimit", "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if limits == nil || limits.Files == nil || limits.Files.TotalStorage == nil {
		// Cloud limit is not applicable
		return 0, nil
	}

	return int64(math.Ceil(float64(*limits.Files.TotalStorage) / 8)), nil
}

func getFileExtFromMimeType(mimeType string) string {
	if mimeType == "image/png" {
		return "png"
	}
	return "jpg"
}

func (a *App) PermanentDeleteFilesByPost(rctx request.CTX, postID string) *model.AppError {
	fileInfos, err := a.Srv().Store().FileInfo().GetForPost(postID, false, true, true)
	if err != nil {
		return model.NewAppError("PermanentDeleteFilesByPost", "app.file_info.get_by_post_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(fileInfos) == 0 {
		rctx.Logger().Debug("No files found for post", mlog.String("post_id", postID))
		return nil
	}

	a.RemoveFilesFromFileStore(rctx, fileInfos)

	err = a.Srv().Store().FileInfo().PermanentDeleteForPost(rctx, postID)
	if err != nil {
		return model.NewAppError("PermanentDeleteFilesByPost", "app.file_info.permanent_delete_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, true)
	a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(postID, false)

	return nil
}

func (a *App) RemoveFilesFromFileStore(rctx request.CTX, fileInfos []*model.FileInfo) {
	for _, info := range fileInfos {
		a.RemoveFileFromFileStore(rctx, info.Path)
		if info.PreviewPath != "" {
			a.RemoveFileFromFileStore(rctx, info.PreviewPath)
		}
		if info.ThumbnailPath != "" {
			a.RemoveFileFromFileStore(rctx, info.ThumbnailPath)
		}
	}
}

func (a *App) RemoveFileFromFileStore(rctx request.CTX, path string) {
	res, appErr := a.FileExists(path)
	if appErr != nil {
		rctx.Logger().Warn(
			"Error checking existence of file",
			mlog.String("path", path),
			mlog.Err(appErr),
		)
		return
	}

	if !res {
		rctx.Logger().Warn("File not found", mlog.String("path", path))
		return
	}

	appErr = a.RemoveFile(path)
	if appErr != nil {
		rctx.Logger().Warn(
			"Unable to remove file",
			mlog.String("path", path),
			mlog.Err(appErr),
		)
		return
	}
}
