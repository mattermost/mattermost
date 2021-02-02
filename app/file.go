// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
	_ "github.com/oov/psd"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	/*
	  EXIF Image Orientations
	  1        2       3      4         5            6           7          8

	  888888  888888      88  88      8888888888  88                  88  8888888888
	  88          88      88  88      88  88      88  88          88  88      88  88
	  8888      8888    8888  8888    88          8888888888  8888888888          88
	  88          88      88  88
	  88          88  888888  888888
	*/
	Upright            = 1
	UprightMirrored    = 2
	UpsideDown         = 3
	UpsideDownMirrored = 4
	RotatedCWMirrored  = 5
	RotatedCCW         = 6
	RotatedCCWMirrored = 7
	RotatedCW          = 8

	MaxImageSize         = int64(6048 * 4032) // 24 megapixels, roughly 36MB as a raw image
	ImageThumbnailWidth  = 120
	ImageThumbnailHeight = 100
	ImageThumbnailRatio  = float64(ImageThumbnailHeight) / float64(ImageThumbnailWidth)
	ImagePreviewWidth    = 1920

	maxUploadInitialBufferSize = 1024 * 1024 // 1Mb

	// Deprecated
	ImageThumbnailPixelWidth  = 120
	ImageThumbnailPixelHeight = 100
	ImagePreviewPixelWidth    = 1920
)

func (a *App) FileBackend() (filesstore.FileBackend, *model.AppError) {
	return a.Srv().FileBackend()
}

func (a *App) CheckMandatoryS3Fields(settings *model.FileSettings) *model.AppError {
	err := filesstore.CheckMandatoryS3Fields(settings)
	if err != nil {
		return model.NewAppError("CheckMandatoryS3Fields", "api.admin.test_s3.missing_s3_bucket", nil, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) TestFilesStoreConnection() *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	nErr := backend.TestConnection()
	if nErr != nil {
		return model.NewAppError("TestConnection", "api.file.test_connection.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) TestFilesStoreConnectionWithConfig(cfg *model.FileSettings) *model.AppError {
	license := a.Srv().License()
	backend, err := filesstore.NewFileBackend(cfg, license != nil && *license.Features.Compliance)
	if err != nil {
		return model.NewAppError("FileBackend", "api.file.no_driver.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	nErr := backend.TestConnection()
	if nErr != nil {
		return model.NewAppError("TestConnection", "api.file.test_connection.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) ReadFile(path string) ([]byte, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	result, nErr := backend.ReadFile(path)
	if nErr != nil {
		return nil, model.NewAppError("ReadFile", "api.file.read_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

// Caller must close the first return value
func (a *App) FileReader(path string) (filesstore.ReadCloseSeeker, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	result, nErr := backend.Reader(path)
	if nErr != nil {
		return nil, model.NewAppError("FileReader", "api.file.file_reader.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func (a *App) FileExists(path string) (bool, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return false, err
	}
	result, nErr := backend.FileExists(path)
	if nErr != nil {
		return false, model.NewAppError("FileExists", "api.file.file_exists.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func (a *App) FileSize(path string) (int64, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return 0, err
	}
	size, nErr := backend.FileSize(path)
	if nErr != nil {
		return 0, model.NewAppError("FileSize", "api.file.file_size.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return size, nil
}

func (a *App) FileModTime(path string) (time.Time, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return time.Time{}, err
	}
	modTime, nErr := backend.FileModTime(path)
	if nErr != nil {
		return time.Time{}, model.NewAppError("FileModTime", "api.file.file_mod_time.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	return modTime, nil
}

func (a *App) MoveFile(oldPath, newPath string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	nErr := backend.MoveFile(oldPath, newPath)
	if nErr != nil {
		return model.NewAppError("MoveFile", "api.file.move_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return 0, err
	}

	result, nErr := backend.WriteFile(fr, path)
	if nErr != nil {
		return result, model.NewAppError("WriteFile", "api.file.write_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func (a *App) AppendFile(fr io.Reader, path string) (int64, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return 0, err
	}

	result, nErr := backend.AppendFile(fr, path)
	if nErr != nil {
		return result, model.NewAppError("AppendFile", "api.file.append_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return result, nil
}

func (a *App) RemoveFile(path string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	nErr := backend.RemoveFile(path)
	if nErr != nil {
		return model.NewAppError("RemoveFile", "api.file.remove_file.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) ListDirectory(path string) ([]string, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	paths, nErr := backend.ListDirectory(path)
	if nErr != nil {
		return nil, model.NewAppError("ListDirectory", "api.file.list_directory.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	return paths, nil
}

func (a *App) RemoveDirectory(path string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	nErr := backend.RemoveDirectory(path)
	if nErr != nil {
		return model.NewAppError("RemoveDirectory", "api.file.remove_directory.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) getInfoForFilename(post *model.Post, teamId, channelId, userId, oldId, filename string) *model.FileInfo {
	name, _ := url.QueryUnescape(filename)
	pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamId, channelId, userId, oldId)
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

	if info.IsImage() {
		nameWithoutExtension := name[:strings.LastIndex(name, ".")]
		info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview.jpg"
		info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb.jpg"
	}

	return info
}

func (a *App) findTeamIdForFilename(post *model.Post, id, filename string) string {
	name, _ := url.QueryUnescape(filename)

	// This post is in a direct channel so we need to figure out what team the files are stored under.
	teams, err := a.Srv().Store.Team().GetTeamsByUserId(post.UserId)
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

// Parse the path from the Filename of the form /{channelId}/{userId}/{uid}/{nameWithExtension}
func parseOldFilenames(filenames []string, channelId, userId string) [][]string {
	parsed := [][]string{}
	for _, filename := range filenames {
		matches := oldFilenameMatchExp.FindStringSubmatch(filename)
		if len(matches) != 5 {
			mlog.Error("Failed to parse old Filename", mlog.String("filename", filename))
			continue
		}
		if matches[1] != channelId {
			mlog.Error("ChannelId in Filename does not match", mlog.String("channel_id", channelId), mlog.String("matched", matches[1]))
		} else if matches[2] != userId {
			mlog.Error("UserId in Filename does not match", mlog.String("user_id", userId), mlog.String("matched", matches[2]))
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

	channel, errCh := a.Srv().Store.Channel().Get(post.ChannelId, true)
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
	var teamId string
	if channel.TeamId == "" {
		// This post was made in a cross-team DM channel, so we need to find where its files were saved
		teamId = a.findTeamIdForFilename(post, parsedFilenames[0][2], parsedFilenames[0][3])
	} else {
		teamId = channel.TeamId
	}

	// Create FileInfo objects for this post
	infos := make([]*model.FileInfo, 0, len(filenames))
	if teamId == "" {
		mlog.Error(
			"Unable to find team id for files when migrating post to use FileInfos",
			mlog.String("filenames", strings.Join(filenames, ",")),
			mlog.String("post_id", post.Id),
		)
	} else {
		for _, parsed := range parsedFilenames {
			info := a.getInfoForFilename(post, teamId, parsed[0], parsed[1], parsed[2], parsed[3])
			if info == nil {
				continue
			}

			infos = append(infos, info)
		}
	}

	// Lock to prevent only one migration thread from trying to update the post at once, preventing duplicate FileInfos from being created
	fileMigrationLock.Lock()
	defer fileMigrationLock.Unlock()

	result, nErr := a.Srv().Store.Post().Get(post.Id, false, false, false)
	if nErr != nil {
		mlog.Error("Unable to get post when migrating post to use FileInfos", mlog.Err(nErr), mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	if newPost := result.Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		var fileInfos []*model.FileInfo
		fileInfos, nErr = a.Srv().Store.FileInfo().GetForPost(post.Id, true, false, false)
		if nErr != nil {
			mlog.Error("Unable to get FileInfos for migrated post", mlog.Err(nErr), mlog.String("post_id", post.Id))
			return []*model.FileInfo{}
		}

		mlog.Debug("Post already migrated to use FileInfos", mlog.String("post_id", post.Id))
		return fileInfos
	}

	mlog.Debug("Migrating post to use FileInfos", mlog.String("post_id", post.Id))

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIds := make([]string, 0, len(filenames))
	for _, info := range infos {
		if _, nErr = a.Srv().Store.FileInfo().Save(info); nErr != nil {
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
		fileIds = append(fileIds, info.Id)
	}

	// Copy and save the updated post
	newPost := post.Clone()

	newPost.Filenames = []string{}
	newPost.FileIds = fileIds

	// Update Posts to clear Filenames and set FileIds
	if _, nErr = a.Srv().Store.Post().Update(newPost, post); nErr != nil {
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

func GeneratePublicLinkHash(fileId, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(salt))
	hash.Write([]byte(fileId))

	return base64.RawURLEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) UploadMultipartFiles(teamId string, channelId string, userId string, fileHeaders []*multipart.FileHeader, clientIds []string, now time.Time) (*model.FileUploadResponse, *model.AppError) {
	files := make([]io.ReadCloser, len(fileHeaders))
	filenames := make([]string, len(fileHeaders))

	for i, fileHeader := range fileHeaders {
		file, fileErr := fileHeader.Open()
		if fileErr != nil {
			return nil, model.NewAppError("UploadFiles", "api.file.upload_file.read_request.app_error",
				map[string]interface{}{"Filename": fileHeader.Filename}, fileErr.Error(), http.StatusBadRequest)
		}

		// Will be closed after UploadFiles returns
		defer file.Close()

		files[i] = file
		filenames[i] = fileHeader.Filename
	}

	return a.UploadFiles(teamId, channelId, userId, files, filenames, clientIds, now)
}

// Uploads some files to the given team and channel as the given user. files and filenames should have
// the same length. clientIds should either not be provided or have the same length as files and filenames.
// The provided files should be closed by the caller so that they are not leaked.
func (a *App) UploadFiles(teamId string, channelId string, userId string, files []io.ReadCloser, filenames []string, clientIds []string, now time.Time) (*model.FileUploadResponse, *model.AppError) {
	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("UploadFiles", "api.file.upload_file.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(filenames) != len(files) || (len(clientIds) > 0 && len(clientIds) != len(files)) {
		return nil, model.NewAppError("UploadFiles", "api.file.upload_file.incorrect_number_of_files.app_error", nil, "", http.StatusBadRequest)
	}

	resStruct := &model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	previewPathList := []string{}
	thumbnailPathList := []string{}
	imageDataList := [][]byte{}

	for i, file := range files {
		buf := bytes.NewBuffer(nil)
		io.Copy(buf, file)
		data := buf.Bytes()

		info, data, err := a.DoUploadFileExpectModification(now, teamId, channelId, userId, filenames[i], data)
		if err != nil {
			return nil, err
		}

		if info.PreviewPath != "" || info.ThumbnailPath != "" {
			previewPathList = append(previewPathList, info.PreviewPath)
			thumbnailPathList = append(thumbnailPathList, info.ThumbnailPath)
			imageDataList = append(imageDataList, data)
		}

		resStruct.FileInfos = append(resStruct.FileInfos, info)

		if len(clientIds) > 0 {
			resStruct.ClientIds = append(resStruct.ClientIds, clientIds[i])
		}
	}

	a.HandleImages(previewPathList, thumbnailPathList, imageDataList)

	return resStruct, nil
}

// UploadFile uploads a single file in form of a completely constructed byte array for a channel.
func (a *App) UploadFile(data []byte, channelId string, filename string) (*model.FileInfo, *model.AppError) {
	_, err := a.GetChannel(channelId)
	if err != nil && channelId != "" {
		return nil, model.NewAppError("UploadFile", "api.file.upload_file.incorrect_channelId.app_error",
			map[string]interface{}{"channelId": channelId}, "", http.StatusBadRequest)
	}

	info, _, appError := a.DoUploadFileExpectModification(time.Now(), "noteam", channelId, "nouser", filename, data)
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

func (a *App) DoUploadFile(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError) {
	info, _, err := a.DoUploadFileExpectModification(now, rawTeamId, rawChannelId, rawUserId, rawFilename, data)
	return info, err
}

func UploadFileSetTeamId(teamId string) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.TeamId = filepath.Base(teamId)
	}
}

func UploadFileSetUserId(userId string) func(t *UploadFileTask) {
	return func(t *UploadFileTask) {
		t.UserId = filepath.Base(userId)
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

	// Cached image data that (may) get initialized in preprocessImage and
	// is used in postprocessImage
	decoded          image.Image
	imageType        string
	imageOrientation int

	// Testing: overrideable dependency functions
	pluginsEnvironment *plugin.Environment
	writeFile          func(io.Reader, string) (int64, *model.AppError)
	saveToDatabase     func(*model.FileInfo) (*model.FileInfo, error)
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
	t.saveToDatabase = a.Srv().Store.FileInfo().Save
}

// UploadFileX uploads a single file as specified in t. It applies the upload
// constraints, executes plugins and image processing logic as needed. It
// returns a filled-out FileInfo and an optional error. A plugin may reject the
// upload, returning a rejection error. In this case FileInfo would have
// contained the last "good" FileInfo before the execution of that plugin.
func (a *App) UploadFileX(channelId, name string, input io.Reader,
	opts ...func(*UploadFileTask)) (*model.FileInfo, *model.AppError) {

	t := &UploadFileTask{
		ChannelId:   filepath.Base(channelId),
		Name:        filepath.Base(name),
		Input:       input,
		maxFileSize: *a.Config().FileSettings.MaxFileSize,
	}
	for _, o := range opts {
		o(t)
	}

	if *a.Config().FileSettings.DriverName == "" {
		return nil, t.newAppError("api.file.upload_file.storage.app_error",
			"", http.StatusNotImplemented)
	}
	if t.ContentLength > t.maxFileSize {
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error",
			"", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
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
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error",
			"", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
	}

	t.fileinfo.Size = written

	file, aerr := a.FileReader(t.fileinfo.Path)
	if aerr != nil {
		return nil, aerr
	}
	defer file.Close()

	aerr = a.runPluginsHook(t.fileinfo, file)
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
			return nil, model.NewAppError("UploadFileX", "app.file_info.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return t.fileinfo, nil
}

func (t *UploadFileTask) preprocessImage() *model.AppError {
	// If SVG, attempt to extract dimensions and then return
	if t.fileinfo.MimeType == "image/svg+xml" {
		svgInfo, err := parseSVG(t.teeInput)
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
	config, _, err := image.DecodeConfig(t.teeInput)
	if err != nil {
		return nil
	}

	t.fileinfo.Width = config.Width
	t.fileinfo.Height = config.Height

	// Check dimensions before loading the whole thing into memory later on.
	// This casting is done to prevent overflow on 32 bit systems (not needed
	// in 64 bits systems because images can't have more than 32 bits height or
	// width)
	if int64(t.fileinfo.Width)*int64(t.fileinfo.Height) > MaxImageSize {
		return t.newAppError("api.file.upload_file.large_image_detailed.app_error",
			"", http.StatusBadRequest)
	}
	t.fileinfo.HasPreviewImage = true
	nameWithoutExtension := t.Name[:strings.LastIndex(t.Name, ".")]
	t.fileinfo.PreviewPath = t.pathPrefix() + nameWithoutExtension + "_preview.jpg"
	t.fileinfo.ThumbnailPath = t.pathPrefix() + nameWithoutExtension + "_thumb.jpg"

	// check the image orientation with goexif; consume the bytes we
	// already have first, then keep Tee-ing from input.
	// TODO: try to reuse exif's .Raw buffer rather than Tee-ing
	if t.imageOrientation, err = getImageOrientation(io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput)); err == nil &&
		(t.imageOrientation == RotatedCWMirrored ||
			t.imageOrientation == RotatedCCW ||
			t.imageOrientation == RotatedCCWMirrored ||
			t.imageOrientation == RotatedCW) {
		t.fileinfo.Width, t.fileinfo.Height = t.fileinfo.Height, t.fileinfo.Width
	}

	// For animated GIFs disable the preview; since we have to Decode gifs
	// anyway, cache the decoded image for later.
	if t.fileinfo.MimeType == "image/gif" {
		gifConfig, err := gif.DecodeAll(io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput))
		if err == nil {
			if len(gifConfig.Image) > 0 {
				t.fileinfo.HasPreviewImage = false
				t.decoded = gifConfig.Image[0]
				t.imageType = "gif"
			}
		}
	}

	return nil
}

func (t *UploadFileTask) postprocessImage(file io.Reader) {
	// don't try to process SVG files
	if t.fileinfo.MimeType == "image/svg+xml" {
		return
	}

	decoded, typ := t.decoded, t.imageType
	if decoded == nil {
		var err error
		decoded, typ, err = image.Decode(file)
		if err != nil {
			mlog.Error("Unable to decode image", mlog.Err(err))
			return
		}
	}

	// Fill in the background of a potentially-transparent png file as
	// white.
	if typ == "png" {
		dst := image.NewRGBA(decoded.Bounds())
		draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
		draw.Draw(dst, dst.Bounds(), decoded, decoded.Bounds().Min, draw.Over)
		decoded = dst
	}

	decoded = makeImageUpright(decoded, t.imageOrientation)
	if decoded == nil {
		return
	}

	const jpegQuality = 90
	writeJPEG := func(img image.Image, path string) {
		r, w := io.Pipe()
		go func() {
			err := jpeg.Encode(w, img, &jpeg.Options{Quality: jpegQuality})
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
		writeJPEG(genThumbnail(decoded), t.fileinfo.ThumbnailPath)
	}()

	go func() {
		defer wg.Done()
		writeJPEG(genPreview(decoded), t.fileinfo.PreviewPath)
	}()

	go func() {
		defer wg.Done()
		if t.fileinfo.MiniPreview == nil {
			t.fileinfo.MiniPreview = model.GenerateMiniPreviewImage(decoded)
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

func (t UploadFileTask) newAppError(id string, details interface{}, httpStatus int, extra ...interface{}) *model.AppError {
	params := map[string]interface{}{
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

	return model.NewAppError("uploadFileTask", id, params, fmt.Sprintf("%v", details), httpStatus)
}

func (a *App) DoUploadFileExpectModification(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, []byte, *model.AppError) {
	filename := filepath.Base(rawFilename)
	teamId := filepath.Base(rawTeamId)
	channelId := filepath.Base(rawChannelId)
	userId := filepath.Base(rawUserId)

	info, err := model.GetInfoForBytes(filename, bytes.NewReader(data), len(data))
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, data, err
	}

	if orientation, err := getImageOrientation(bytes.NewReader(data)); err == nil &&
		(orientation == RotatedCWMirrored ||
			orientation == RotatedCCW ||
			orientation == RotatedCCWMirrored ||
			orientation == RotatedCW) {
		info.Width, info.Height = info.Height, info.Width
	}

	info.Id = model.NewId()
	info.CreatorId = userId
	info.CreateAt = now.UnixNano() / int64(time.Millisecond)

	pathPrefix := now.Format("20060102") + "/teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + info.Id + "/"
	info.Path = pathPrefix + filename

	if info.IsImage() {
		// Check dimensions before loading the whole thing into memory later on
		// This casting is done to prevent overflow on 32 bit systems (not needed
		// in 64 bits systems because images can't have more than 32 bits height or
		// width)
		if int64(info.Width)*int64(info.Height) > MaxImageSize {
			err := model.NewAppError("uploadFile", "api.file.upload_file.large_image.app_error", map[string]interface{}{"Filename": filename}, "", http.StatusBadRequest)
			return nil, data, err
		}

		nameWithoutExtension := filename[:strings.LastIndex(filename, ".")]
		info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview.jpg"
		info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb.jpg"
	}

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		var rejectionError *model.AppError
		pluginContext := a.PluginContext()
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
		}, plugin.FileWillBeUploadedId)
		if rejectionError != nil {
			return nil, data, rejectionError
		}
	}

	if _, err := a.WriteFile(bytes.NewReader(data), info.Path); err != nil {
		return nil, data, err
	}

	if _, err := a.Srv().Store.FileInfo().Save(info); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, data, appErr
		default:
			return nil, data, model.NewAppError("DoUploadFileExpectModification", "app.file_info.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return info, data, nil
}

func (a *App) HandleImages(previewPathList []string, thumbnailPathList []string, fileData [][]byte) {
	wg := new(sync.WaitGroup)

	for i := range fileData {
		img, width, _ := prepareImage(fileData[i])
		if img != nil {
			wg.Add(2)
			go func(img image.Image, path string) {
				defer wg.Done()
				a.generateThumbnailImage(img, path)
			}(img, thumbnailPathList[i])

			go func(img image.Image, path string, width int) {
				defer wg.Done()
				a.generatePreviewImage(img, path, width)
			}(img, previewPathList[i], width)
		}
	}
	wg.Wait()
}

func prepareImage(fileData []byte) (image.Image, int, int) {
	// Decode image bytes into Image object
	img, imgType, err := image.Decode(bytes.NewReader(fileData))
	if err != nil {
		mlog.Error("Unable to decode image", mlog.Err(err))
		return nil, 0, 0
	}

	width := img.Bounds().Dx()
	height := img.Bounds().Dy()

	// Fill in the background of a potentially-transparent png file as white
	if imgType == "png" {
		dst := image.NewRGBA(img.Bounds())
		draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
		draw.Draw(dst, dst.Bounds(), img, img.Bounds().Min, draw.Over)
		img = dst
	}

	// Flip the image to be upright
	orientation, _ := getImageOrientation(bytes.NewReader(fileData))
	img = makeImageUpright(img, orientation)

	return img, width, height
}

func makeImageUpright(img image.Image, orientation int) image.Image {
	switch orientation {
	case UprightMirrored:
		return imaging.FlipH(img)
	case UpsideDown:
		return imaging.Rotate180(img)
	case UpsideDownMirrored:
		return imaging.FlipV(img)
	case RotatedCWMirrored:
		return imaging.Transpose(img)
	case RotatedCCW:
		return imaging.Rotate270(img)
	case RotatedCCWMirrored:
		return imaging.Transverse(img)
	case RotatedCW:
		return imaging.Rotate90(img)
	default:
		return img
	}
}

func getImageOrientation(input io.Reader) (int, error) {
	exifData, err := exif.Decode(input)
	if err != nil {
		return Upright, err
	}

	tag, err := exifData.Get("Orientation")
	if err != nil {
		return Upright, err
	}

	orientation, err := tag.Int(0)
	if err != nil {
		return Upright, err
	}

	return orientation, nil
}

func (a *App) generateThumbnailImage(img image.Image, thumbnailPath string) {
	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, genThumbnail(img), &jpeg.Options{Quality: 90}); err != nil {
		mlog.Error("Unable to encode image as jpeg", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}

	if _, err := a.WriteFile(buf, thumbnailPath); err != nil {
		mlog.Error("Unable to upload thumbnail", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}
}

func (a *App) generatePreviewImage(img image.Image, previewPath string, width int) {
	preview := genPreview(img)

	buf := new(bytes.Buffer)

	if err := jpeg.Encode(buf, preview, &jpeg.Options{Quality: 90}); err != nil {
		mlog.Error("Unable to encode image as preview jpg", mlog.Err(err), mlog.String("path", previewPath))
		return
	}

	if _, err := a.WriteFile(buf, previewPath); err != nil {
		mlog.Error("Unable to upload preview", mlog.Err(err), mlog.String("path", previewPath))
		return
	}
}

// generateMiniPreview updates mini preview if needed
// will save fileinfo with the preview added
func (a *App) generateMiniPreview(fi *model.FileInfo) {
	if fi.IsImage() && fi.MiniPreview == nil {
		data, err := a.ReadFile(fi.Path)
		if err != nil {
			mlog.Error("error reading image file", mlog.Err(err))
			return
		}
		img, _, _ := prepareImage(data)
		if img == nil {
			return
		}
		fi.MiniPreview = model.GenerateMiniPreviewImage(img)
		if _, appErr := a.Srv().Store.FileInfo().Upsert(fi); appErr != nil {
			mlog.Error("creating mini preview failed", mlog.Err(appErr))
		} else {
			a.Srv().Store.FileInfo().InvalidateFileInfosForPostCache(fi.PostId, false)
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

func (a *App) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	fileInfo, err := a.Srv().Store.FileInfo().Get(fileId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetFileInfo", "app.file_info.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetFileInfo", "app.file_info.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	a.generateMiniPreview(fileInfo)
	return fileInfo, nil
}

func (a *App) GetFileInfos(page, perPage int, opt *model.GetFileInfosOptions) ([]*model.FileInfo, *model.AppError) {
	fileInfos, err := a.Srv().Store.FileInfo().GetWithOptions(page, perPage, opt)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var ltErr *store.ErrLimitExceeded
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, invErr.Error(), http.StatusBadRequest)
		case errors.As(err, &ltErr):
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, ltErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("GetFileInfos", "app.file_info.get_with_options.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	a.generateMiniPreviewForInfos(fileInfos)

	return fileInfos, nil
}

func (a *App) GetFile(fileId string) ([]byte, *model.AppError) {
	info, err := a.GetFileInfo(fileId)
	if err != nil {
		return nil, err
	}

	data, err := a.ReadFile(info.Path)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (a *App) CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError) {
	var newFileIds []string

	now := model.GetMillis()

	for _, fileId := range fileIds {
		fileInfo, err := a.Srv().Store.FileInfo().Get(fileId)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.get.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		fileInfo.Id = model.NewId()
		fileInfo.CreatorId = userId
		fileInfo.CreateAt = now
		fileInfo.UpdateAt = now
		fileInfo.PostId = ""

		if _, err := a.Srv().Store.FileInfo().Save(fileInfo); err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("CopyFileInfos", "app.file_info.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		newFileIds = append(newFileIds, fileInfo.Id)
	}

	return newFileIds, nil
}

// This function zip's up all the files in fileDatas array and then saves it to the directory specified with the specified zip file name
// Ensure the zip file name ends with a .zip
func (a *App) CreateZipFileAndAddFiles(fileBackend filesstore.FileBackend, fileDatas []model.FileData, zipFileName, directory string) error {
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
