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

	"github.com/mattermost/mattermost-server/v6/app/imaging"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/services/docextractor"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"

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

// Ensure fileInfo service wrapper implements `product.FileInfoStoreService`
var _ product.FileInfoStoreService = (*fileInfoWrapper)(nil)

// fileInfoWrapper implements `product.FileInfoStoreService` for use by products.
type fileInfoWrapper struct {
	srv *Server
}

func (f *fileInfoWrapper) GetFileInfo(fileID string) (*model.FileInfo, *model.AppError) {
	return f.srv.getFileInfo(fileID)
}

func (a *App) FileBackend() filestore.FileBackend {
	return a.ch.filestore
}

func (a *App) CheckMandatoryS3Fields(settings *model.FileSettings) *model.AppError {
	fileBackendSettings := settings.ToFileBackendSettings(false, false)
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
	backend, err := filestore.NewFileBackend(cfg.ToFileBackendSettings(license != nil && *license.Features.Compliance, insecure != nil && *insecure))
	if err != nil {
		return model.NewAppError("FileBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

func (s *Server) fileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	result, nErr := s.FileBackend().Reader(path)
	if nErr != nil {
		return nil, model.NewAppError("FileReader", "api.file.file_reader.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

// Caller must close the first return value
func (a *App) FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return a.Srv().fileReader(path)
}

func (a *App) FileExists(path string) (bool, *model.AppError) {
	return a.Srv().fileExists(path)
}

func (s *Server) fileExists(path string) (bool, *model.AppError) {
	result, nErr := s.FileBackend().FileExists(path)
	if nErr != nil {
		return false, model.NewAppError("FileExists", "api.file.file_exists.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
}

func (a *App) FileSize(path string) (int64, *model.AppError) {
	size, nErr := a.FileBackend().FileSize(path)
	if nErr != nil {
		return 0, model.NewAppError("FileSize", "api.file.file_size.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return size, nil
}

func (a *App) FileModTime(path string) (time.Time, *model.AppError) {
	modTime, nErr := a.FileBackend().FileModTime(path)
	if nErr != nil {
		return time.Time{}, model.NewAppError("FileModTime", "api.file.file_mod_time.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return modTime, nil
}

func (a *App) MoveFile(oldPath, newPath string) *model.AppError {
	nErr := a.FileBackend().MoveFile(oldPath, newPath)
	if nErr != nil {
		return model.NewAppError("MoveFile", "api.file.move_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return nil
}

func (a *App) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	return a.Srv().writeFile(fr, path)
}

func (s *Server) writeFile(fr io.Reader, path string) (int64, *model.AppError) {
	result, nErr := s.FileBackend().WriteFile(fr, path)
	if nErr != nil {
		return result, model.NewAppError("WriteFile", "api.file.write_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return result, nil
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

func (s *Server) removeFile(path string) *model.AppError {
	nErr := s.FileBackend().RemoveFile(path)
	if nErr != nil {
		return model.NewAppError("RemoveFile", "api.file.remove_file.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return nil
}

func (a *App) ListDirectory(path string) ([]string, *model.AppError) {
	return a.Srv().listDirectory(path, false)
}

func (a *App) ListDirectoryRecursively(path string) ([]string, *model.AppError) {
	return a.Srv().listDirectory(path, true)
}

func (s *Server) listDirectory(path string, recursion bool) ([]string, *model.AppError) {
	backend := s.FileBackend()
	var paths []string
	var nErr error

	if recursion {
		paths, nErr = backend.ListDirectoryRecursively(path)
	} else {
		paths, nErr = backend.ListDirectory(path)
	}

	if nErr != nil {
		return nil, model.NewAppError("ListDirectory", "api.file.list_directory.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return paths, nil
}

func (a *App) RemoveDirectory(path string) *model.AppError {
	nErr := a.FileBackend().RemoveDirectory(path)
	if nErr != nil {
		return model.NewAppError("RemoveDirectory", "api.file.remove_directory.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return nil
}

func (a *App) getInfoForFilename(post *model.Post, teamID, channelID, userID, oldId, filename string) *model.FileInfo {
	name, _ := url.QueryUnescape(filename)
	pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamID, channelID, userID, oldId)
	path := pathPrefix + name

	// Open the file and populate the fields of the FileInfo
	data, err := a.ReadFile(path)
	if err != nil {
		mlog.Error(
			"File not found when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("filename", filename),
			mlog.String("path", path),
			mlog.Err(err),
		)
		return nil
	}

	info, err := model.GetInfoForBytes(name, bytes.NewReader(data), len(data))
	if err != nil {
		mlog.Warn(
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

func (a *App) findTeamIdForFilename(post *model.Post, id, filename string) string {
	name, _ := url.QueryUnescape(filename)

	// This post is in a direct channel so we need to figure out what team the files are stored under.
	teams, err := a.Srv().Store().Team().GetTeamsByUserId(post.UserId)
	if err != nil {
		mlog.Error("Unable to get teams when migrating post to use FileInfo", mlog.Err(err), mlog.String("post_id", post.Id))
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

var fileMigrationLock sync.Mutex
var oldFilenameMatchExp *regexp.Regexp = regexp.MustCompile(`^\/([a-z\d]{26})\/([a-z\d]{26})\/([a-z\d]{26})\/([^\/]+)$`)

// Parse the path from the Filename of the form /{channelID}/{userID}/{uid}/{nameWithExtension}
func parseOldFilenames(filenames []string, channelID, userID string) [][]string {
	parsed := [][]string{}
	for _, filename := range filenames {
		matches := oldFilenameMatchExp.FindStringSubmatch(filename)
		if len(matches) != 5 {
			mlog.Error("Failed to parse old Filename", mlog.String("filename", filename))
			continue
		}
		if matches[1] != channelID {
			mlog.Error("ChannelId in Filename does not match", mlog.String("channel_id", channelID), mlog.String("matched", matches[1]))
		} else if matches[2] != userID {
			mlog.Error("UserId in Filename does not match", mlog.String("user_id", userID), mlog.String("matched", matches[2]))
		} else {
			parsed = append(parsed, matches[1:])
		}
	}
	return parsed
}

// Creates and stores FileInfos for a post created before the FileInfos table existed.
func (a *App) MigrateFilenamesToFileInfos(post *model.Post) []*model.FileInfo {
	if len(post.Filenames) == 0 {
		mlog.Warn("Unable to migrate post to use FileInfos with an empty Filenames field", mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	channel, errCh := a.Srv().Store().Channel().Get(post.ChannelId, true)
	// There's a weird bug that rarely happens where a post ends up with duplicate Filenames so remove those
	filenames := utils.RemoveDuplicatesFromStringArray(post.Filenames)
	if errCh != nil {
		mlog.Error(
			"Unable to get channel when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(errCh),
		)
		return []*model.FileInfo{}
	}

	// Parse and validate filenames before further processing
	parsedFilenames := parseOldFilenames(filenames, post.ChannelId, post.UserId)

	if len(parsedFilenames) == 0 {
		mlog.Error("Unable to parse filenames")
		return []*model.FileInfo{}
	}

	// Find the team that was used to make this post since its part of the file path that isn't saved in the Filename
	var teamID string
	if channel.TeamId == "" {
		// This post was made in a cross-team DM channel, so we need to find where its files were saved
		teamID = a.findTeamIdForFilename(post, parsedFilenames[0][2], parsedFilenames[0][3])
	} else {
		teamID = channel.TeamId
	}

	// Create FileInfo objects for this post
	infos := make([]*model.FileInfo, 0, len(filenames))
	if teamID == "" {
		mlog.Error(
			"Unable to find team id for files when migrating post to use FileInfos",
			mlog.String("filenames", strings.Join(filenames, ",")),
			mlog.String("post_id", post.Id),
		)
	} else {
		for _, parsed := range parsedFilenames {
			info := a.getInfoForFilename(post, teamID, parsed[0], parsed[1], parsed[2], parsed[3])
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
		mlog.Error("Unable to get post when migrating post to use FileInfos", mlog.Err(nErr), mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	if newPost := result.Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		var fileInfos []*model.FileInfo
		fileInfos, nErr = a.Srv().Store().FileInfo().GetForPost(post.Id, true, false, false)
		if nErr != nil {
			mlog.Error("Unable to get FileInfos for migrated post", mlog.Err(nErr), mlog.String("post_id", post.Id))
			return []*model.FileInfo{}
		}

		mlog.Debug("Post already migrated to use FileInfos", mlog.String("post_id", post.Id))
		return fileInfos
	}

	mlog.Debug("Migrating post to use FileInfos", mlog.String("post_id", post.Id))

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIDs := make([]string, 0, len(filenames))
	for _, info := range infos {
		if _, nErr = a.Srv().Store().FileInfo().Save(info); nErr != nil {
			mlog.Error(
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
	if _, nErr = a.Srv().Store().Post().Update(newPost, post); nErr != nil {
		mlog.Error(
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
	_, err := a.GetChannel(c, channelID)
	if err != nil && channelID != "" {
		return nil, model.NewAppError("UploadFile", "api.file.upload_file.incorrect_channelId.app_error",
			map[string]any{"channelId": channelID}, "", http.StatusBadRequest)
	}

	info, _, appError := a.DoUploadFileExpectModification(c, time.Now(), "noteam", channelID, "nouser", filename, data)
	if appError != nil {
		return nil, appError
	}

	if info.PreviewPath != "" || info.ThumbnailPath != "" {
		previewPathList := []string{info.PreviewPath}
		thumbnailPathList := []string{info.ThumbnailPath}
		imageDataList := [][]byte{data}

		a.HandleImages(previewPathList, thumbnailPathList, imageDataList)
	}

	return info, nil
}

func (a *App) DoUploadFile(c request.CTX, now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError) {
	info, _, err := a.DoUploadFileExpectModification(c, now, rawTeamId, rawChannelId, rawUserId, rawFilename, data)
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

type UploadFileTask struct {
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
	saveToDatabase     func(*model.FileInfo) (*model.FileInfo, error)

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
func (a *App) UploadFileX(c *request.Context, channelID, name string, input io.Reader,
	opts ...func(*UploadFileTask)) (*model.FileInfo, *model.AppError) {

	t := &UploadFileTask{
		ChannelId:   filepath.Base(channelID),
		Name:        filepath.Base(name),
		Input:       input,
		maxFileSize: *a.Config().FileSettings.MaxFileSize,
		maxImageRes: *a.Config().FileSettings.MaxImageResolution,
		imgDecoder:  a.ch.imgDecoder,
		imgEncoder:  a.ch.imgEncoder,
	}
	for _, o := range opts {
		o(t)
	}

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
			mlog.Error("Failed to remove file", mlog.Err(fileErr))
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

	if _, err := t.saveToDatabase(t.fileinfo); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UploadFileX", "app.file_info.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if *a.Config().FileSettings.ExtractContent {
		infoCopy := *t.fileinfo
		a.Srv().GoBuffered(func() {
			err := a.ExtractContentFromFileInfo(&infoCopy)
			if err != nil {
				mlog.Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
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
			mlog.Warn("Failed to parse SVG", mlog.Err(err))
		}
		if svgInfo.Width > 0 && svgInfo.Height > 0 {
			t.fileinfo.Width = svgInfo.Width
			t.fileinfo.Height = svgInfo.Height
		}
		t.fileinfo.HasPreviewImage = false
		return nil
	}

	// If we fail to decode, return "as is".
	w, h, err := imaging.GetDimensions(t.teeInput)
	if err != nil {
		return nil
	}
	t.fileinfo.Width = w
	t.fileinfo.Height = h

	if err = checkImageResolutionLimit(w, h, t.maxImageRes); err != nil {
		return t.newAppError("api.file.upload_file.large_image_detailed.app_error", http.StatusBadRequest)
	}

	t.fileinfo.HasPreviewImage = true
	nameWithoutExtension := t.Name[:strings.LastIndex(t.Name, ".")]
	t.fileinfo.PreviewPath = t.pathPrefix() + nameWithoutExtension + "_preview." + getFileExtFromMimeType(t.fileinfo.MimeType)
	t.fileinfo.ThumbnailPath = t.pathPrefix() + nameWithoutExtension + "_thumb." + getFileExtFromMimeType(t.fileinfo.MimeType)

	// check the image orientation with goexif; consume the bytes we
	// already have first, then keep Tee-ing from input.
	// TODO: try to reuse exif's .Raw buffer rather than Tee-ing
	if t.imageOrientation, err = imaging.GetImageOrientation(io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput)); err == nil &&
		(t.imageOrientation == imaging.RotatedCWMirrored ||
			t.imageOrientation == imaging.RotatedCCW ||
			t.imageOrientation == imaging.RotatedCCWMirrored ||
			t.imageOrientation == imaging.RotatedCW) {
		t.fileinfo.Width, t.fileinfo.Height = t.fileinfo.Height, t.fileinfo.Width
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
			mlog.Error("Unable to decode image", mlog.Err(err))
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
				mlog.Error("Unable to encode image as jpeg", mlog.String("path", path), mlog.Err(err))
				w.CloseWithError(err)
			} else {
				w.Close()
			}
		}()
		_, aerr := t.writeFile(r, path)
		if aerr != nil {
			mlog.Error("Unable to upload", mlog.String("path", path), mlog.Err(aerr))
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
				mlog.Info("Unable to generate mini preview image", mlog.Err(err))
			} else {
				t.fileinfo.MiniPreview = &miniPreview
			}
		}
	}()
	wg.Wait()
}

func (t UploadFileTask) pathPrefix() string {
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

func (a *App) DoUploadFileExpectModification(c request.CTX, now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, []byte, *model.AppError) {
	filename := filepath.Base(rawFilename)
	teamID := filepath.Base(rawTeamId)
	channelID := filepath.Base(rawChannelId)
	userID := filepath.Base(rawUserId)

	info, err := model.GetInfoForBytes(filename, bytes.NewReader(data), len(data))
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, data, err
	}

	if orientation, err := imaging.GetImageOrientation(bytes.NewReader(data)); err == nil &&
		(orientation == imaging.RotatedCWMirrored ||
			orientation == imaging.RotatedCCW ||
			orientation == imaging.RotatedCCWMirrored ||
			orientation == imaging.RotatedCW) {
		info.Width, info.Height = info.Height, info.Width
	}

	info.Id = model.NewId()
	info.CreatorId = userID
	info.CreateAt = now.UnixNano() / int64(time.Millisecond)

	pathPrefix := now.Format("20060102") + "/teams/" + teamID + "/channels/" + channelID + "/users/" + userID + "/" + info.Id + "/"
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

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var rejectionError *model.AppError
		pluginContext := pluginContext(c)
		pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
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
	}

	if _, err := a.WriteFile(bytes.NewReader(data), info.Path); err != nil {
		return nil, data, err
	}

	if _, err := a.Srv().Store().FileInfo().Save(info); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, data, appErr
		default:
			return nil, data, model.NewAppError("DoUploadFileExpectModification", "app.file_info.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if *a.Config().FileSettings.ExtractContent {
		infoCopy := *info
		a.Srv().GoBuffered(func() {
			err := a.ExtractContentFromFileInfo(&infoCopy)
			if err != nil {
				mlog.Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
			}
		})
	}

	return info, data, nil
}

func (a *App) HandleImages(previewPathList []string, thumbnailPathList []string, fileData [][]byte) {
	wg := new(sync.WaitGroup)

	for i := range fileData {
		img, imgType, release, err := prepareImage(a.ch.imgDecoder, bytes.NewReader(fileData[i]))
		if err != nil {
			mlog.Debug("Failed to prepare image", mlog.Err(err))
			continue
		}
		wg.Add(2)
		go func(img image.Image, imgType, path string) {
			defer wg.Done()
			a.generateThumbnailImage(img, imgType, path)
		}(img, imgType, thumbnailPathList[i])

		go func(img image.Image, imgType, path string) {
			defer wg.Done()
			a.generatePreviewImage(img, imgType, path)
		}(img, imgType, previewPathList[i])

		wg.Wait()
		release()
	}
}

func prepareImage(imgDecoder *imaging.Decoder, imgData io.ReadSeeker) (img image.Image, imgType string, release func(), err error) {
	// Decode image bytes into Image object
	img, imgType, release, err = imgDecoder.DecodeMemBounded(imgData)
	if err != nil {
		return nil, "", nil, fmt.Errorf("prepareImage: failed to decode image: %w", err)
	}
	imgData.Seek(0, io.SeekStart)

	// Flip the image to be upright
	orientation, err := imaging.GetImageOrientation(imgData)
	if err != nil {
		mlog.Debug("GetImageOrientation failed", mlog.Err(err))
	}
	img = imaging.MakeImageUpright(img, orientation)

	return img, imgType, release, nil
}

func (a *App) generateThumbnailImage(img image.Image, imgType, thumbnailPath string) {
	var buf bytes.Buffer

	thumb := imaging.GenerateThumbnail(img, imageThumbnailWidth, imageThumbnailHeight)
	if imgType == "png" {
		if err := a.ch.imgEncoder.EncodePNG(&buf, thumb); err != nil {
			mlog.Error("Unable to encode image as png", mlog.String("path", thumbnailPath), mlog.Err(err))
			return
		}
	} else {
		if err := a.ch.imgEncoder.EncodeJPEG(&buf, thumb, jpegEncQuality); err != nil {
			mlog.Error("Unable to encode image as jpeg", mlog.String("path", thumbnailPath), mlog.Err(err))
			return
		}
	}

	if _, err := a.WriteFile(&buf, thumbnailPath); err != nil {
		mlog.Error("Unable to upload thumbnail", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}
}

func (a *App) generatePreviewImage(img image.Image, imgType, previewPath string) {
	var buf bytes.Buffer

	preview := imaging.GeneratePreview(img, imagePreviewWidth)
	if imgType == "png" {
		if err := a.ch.imgEncoder.EncodePNG(&buf, preview); err != nil {
			mlog.Error("Unable to encode image as preview png", mlog.Err(err), mlog.String("path", previewPath))
			return
		}
	} else {
		if err := a.ch.imgEncoder.EncodeJPEG(&buf, preview, jpegEncQuality); err != nil {
			mlog.Error("Unable to encode image as preview jpg", mlog.Err(err), mlog.String("path", previewPath))
			return
		}
	}

	if _, err := a.WriteFile(&buf, previewPath); err != nil {
		mlog.Error("Unable to upload preview", mlog.Err(err), mlog.String("path", previewPath))
		return
	}
}

// generateMiniPreview updates mini preview if needed
// will save fileinfo with the preview added
func (a *App) generateMiniPreview(fi *model.FileInfo) {
	if fi.IsImage() && !fi.IsSvg() && fi.MiniPreview == nil {
		file, appErr := a.FileReader(fi.Path)
		if appErr != nil {
			mlog.Debug("error reading image file", mlog.Err(appErr))
			return
		}
		defer file.Close()
		img, _, release, err := prepareImage(a.ch.imgDecoder, file)
		if err != nil {
			mlog.Debug("generateMiniPreview: prepareImage failed", mlog.Err(err),
				mlog.String("fileinfo_id", fi.Id), mlog.String("channel_id", fi.ChannelId),
				mlog.String("creator_id", fi.CreatorId))
			return
		}
		defer release()
		var miniPreview []byte
		if miniPreview, err = imaging.GenerateMiniPreviewImage(img,
			miniPreviewImageWidth, miniPreviewImageHeight, jpegEncQuality); err != nil {
			mlog.Info("Unable to generate mini preview image", mlog.Err(err))
		} else {
			fi.MiniPreview = &miniPreview
		}
		if _, err = a.Srv().Store().FileInfo().Upsert(fi); err != nil {
			mlog.Debug("creating mini preview failed", mlog.Err(err))
		} else {
			a.Srv().Store().FileInfo().InvalidateFileInfosForPostCache(fi.PostId, false)
		}
	}
}

func (a *App) generateMiniPreviewForInfos(fileInfos []*model.FileInfo) {
	wg := new(sync.WaitGroup)

	wg.Add(len(fileInfos))
	for _, fileInfo := range fileInfos {
		go func(fi *model.FileInfo) {
			defer wg.Done()
			a.generateMiniPreview(fi)
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

func (a *App) GetFileInfo(fileID string) (*model.FileInfo, *model.AppError) {
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

	a.generateMiniPreview(fileInfo)
	return fileInfo, appErr
}

func (a *App) getFileInfoIgnoreCloudLimit(fileID string) (*model.FileInfo, *model.AppError) {
	fileInfo, appErr := a.Srv().getFileInfo(fileID)
	if appErr == nil {
		a.generateMiniPreview(fileInfo)
	}

	return fileInfo, appErr
}

func (a *App) GetFileInfos(page, perPage int, opt *model.GetFileInfosOptions) ([]*model.FileInfo, *model.AppError) {
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

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, nil
}

func (a *App) GetFile(fileID string) ([]byte, *model.AppError) {
	info, err := a.GetFileInfo(fileID)
	if err != nil {
		return nil, err
	}

	data, err := a.ReadFile(info.Path)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (a *App) getFileIgnoreCloudLimit(fileID string) ([]byte, *model.AppError) {
	info, err := a.getFileInfoIgnoreCloudLimit(fileID)
	if err != nil {
		return nil, err
	}

	data, err := a.ReadFile(info.Path)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (a *App) CopyFileInfos(userID string, fileIDs []string) ([]string, *model.AppError) {
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

		if _, err := a.Srv().Store().FileInfo().Save(fileInfo); err != nil {
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
		return err
	}
	defer os.Remove(zipFileName)

	// Create a new zip archive.
	zipFileWriter := zip.NewWriter(conglomerateZipFile)

	// Populate Zip file with File Datas array
	err = populateZipfile(zipFileWriter, fileDatas)
	if err != nil {
		return err
	}

	conglomerateZipFile.Seek(0, 0)
	_, err = fileBackend.WriteFile(conglomerateZipFile, path.Join(directory, zipFileName))
	if err != nil {
		return err
	}

	return nil
}

// This is a implementation of Go's example of writing files to zip (with slight modification)
// https://golang.org/src/archive/zip/example_test.go
func populateZipfile(w *zip.Writer, fileDatas []model.FileData) error {
	defer w.Close()
	for _, fd := range fileDatas {
		f, err := w.Create(fd.Filename)
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

func (a *App) SearchFilesInTeamForUser(c *request.Context, terms string, userId string, teamId string, isOrSearch bool, includeDeletedChannels bool, timeZoneOffset int, page, perPage int, modifier string) (*model.FileInfoList, *model.AppError) {
	paramsList := model.ParseSearchParams(strings.TrimSpace(terms), timeZoneOffset)
	includeDeleted := includeDeletedChannels && *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	if !*a.Config().ServiceSettings.EnableFileSearch {
		return nil, model.NewAppError("SearchFilesInTeamForUser", "store.sql_file_info.search.disabled", nil, fmt.Sprintf("teamId=%v userId=%v", teamId, userId), http.StatusNotImplemented)
	}

	finalParamsList := []*model.SearchParams{}

	for _, params := range paramsList {
		params.Modifier = modifier
		params.OrTerms = isOrSearch
		params.IncludeDeletedChannels = includeDeleted
		// Don't allow users to search for "*"
		if params.Terms != "*" {
			// Convert channel names to channel IDs
			params.InChannels = a.convertChannelNamesToChannelIds(c, params.InChannels, userId, teamId, includeDeletedChannels)
			params.ExcludedChannels = a.convertChannelNamesToChannelIds(c, params.ExcludedChannels, userId, teamId, includeDeletedChannels)

			// Convert usernames to user IDs
			params.FromUsers = a.convertUserNameToUserIds(params.FromUsers)
			params.ExcludedUsers = a.convertUserNameToUserIds(params.ExcludedUsers)

			finalParamsList = append(finalParamsList, params)
		}
	}

	// If the processed search params are empty, return empty search results.
	if len(finalParamsList) == 0 {
		return model.NewFileInfoList(), nil
	}

	fileInfoSearchResults, nErr := a.Srv().Store().FileInfo().Search(finalParamsList, userId, teamId, page, perPage)
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

func (a *App) ExtractContentFromFileInfo(fileInfo *model.FileInfo) error {
	// We don't process images.
	if fileInfo.IsImage() {
		return nil
	}

	file, aerr := a.FileReader(fileInfo.Path)
	if aerr != nil {
		return errors.Wrap(aerr, "failed to open file for extract file content")
	}
	defer file.Close()
	text, err := docextractor.Extract(fileInfo.Name, file, docextractor.ExtractSettings{
		ArchiveRecursion: *a.Config().FileSettings.ArchiveRecursion,
	})
	if err != nil {
		return errors.Wrap(err, "failed to extract file content")
	}
	if text != "" {
		if len(text) > maxContentExtractionSize {
			text = text[0:maxContentExtractionSize]
		}
		if storeErr := a.Srv().Store().FileInfo().SetContent(fileInfo.Id, text); storeErr != nil {
			return errors.Wrap(storeErr, "failed to save the extracted file content")
		}
		reloadFileInfo, storeErr := a.Srv().Store().FileInfo().Get(fileInfo.Id)
		if storeErr != nil {
			mlog.Warn("Failed to invalidate the fileInfo cache.", mlog.Err(storeErr), mlog.String("file_info_id", fileInfo.Id))
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
			return 0, model.NewAppError("GetLastAccessibleFileTime", "app.system.get_by_name.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	lastAccessibleFileTime, err := strconv.ParseInt(system.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("GetLastAccessibleFileTime", "common.parse_error_int64", map[string]interface{}{"Value": system.Value}, err.Error(), http.StatusInternalServerError)
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

	createdAt, err := a.Srv().GetStore().FileInfo().GetUptoNSizeFileTime(limit)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("ComputeLastAccessibleFileTime", "app.last_accessible_file.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	// Update Cache
	err = a.Srv().Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: strconv.FormatInt(createdAt, 10),
	})
	if err != nil {
		return model.NewAppError("ComputeLastAccessibleFileTime", "app.system.save.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		return 0, model.NewAppError("getCloudFilesSizeLimit", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
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
