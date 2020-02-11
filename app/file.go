// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
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
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
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

	MaxImageSize         = 6048 * 4032 // 24 megapixels, roughly 36MB as a raw image
	ImageThumbnailWidth  = 120
	ImageThumbnailHeight = 100
	ImageThumbnailRatio  = float64(ImageThumbnailHeight) / float64(ImageThumbnailWidth)
	ImagePreviewWidth    = 1920

	UploadFileInitialBufferSize = 2 * 1024 * 1024 // 2Mb

	// Deprecated
	IMAGE_THUMBNAIL_PIXEL_WIDTH  = 120
	IMAGE_THUMBNAIL_PIXEL_HEIGHT = 100
	IMAGE_PREVIEW_PIXEL_WIDTH    = 1920
)

func (a *App) FileBackend() (filesstore.FileBackend, *model.AppError) {
	license := a.License()
	return filesstore.NewFileBackend(&a.Config().FileSettings, license != nil && *license.Features.Compliance)
}

func (a *App) ReadFile(path string) ([]byte, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	return backend.ReadFile(path)
}

// Caller must close the first return value
func (a *App) FileReader(path string) (filesstore.ReadCloseSeeker, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	return backend.Reader(path)
}

func (a *App) FileExists(path string) (bool, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return false, err
	}
	return backend.FileExists(path)
}

func (a *App) MoveFile(oldPath, newPath string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	return backend.MoveFile(oldPath, newPath)
}

func (a *App) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return 0, err
	}

	return backend.WriteFile(fr, path)
}

func (a *App) RemoveFile(path string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	return backend.RemoveFile(path)
}

func (a *App) ListDirectory(path string) ([]string, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	paths, err := backend.ListDirectory(path)
	if err != nil {
		return nil, err
	}

	return *paths, nil
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

	info, err := model.GetInfoForBytes(name, data)
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
	teams, err := a.Srv.Store.Team().GetTeamsByUserId(post.UserId)
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

	channel, errCh := a.Srv.Store.Channel().Get(post.ChannelId, true)
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

	result, err := a.Srv.Store.Post().Get(post.Id, false)
	if err != nil {
		mlog.Error("Unable to get post when migrating post to use FileInfos", mlog.Err(err), mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	if newPost := result.Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		var fileInfos []*model.FileInfo
		fileInfos, err = a.Srv.Store.FileInfo().GetForPost(post.Id, true, false, false)
		if err != nil {
			mlog.Error("Unable to get FileInfos for migrated post", mlog.Err(err), mlog.String("post_id", post.Id))
			return []*model.FileInfo{}
		}

		mlog.Debug("Post already migrated to use FileInfos", mlog.String("post_id", post.Id))
		return fileInfos
	}

	mlog.Debug("Migrating post to use FileInfos", mlog.String("post_id", post.Id))

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIds := make([]string, 0, len(filenames))
	for _, info := range infos {
		if _, err = a.Srv.Store.FileInfo().Save(info); err != nil {
			mlog.Error(
				"Unable to save file info when migrating post to use FileInfos",
				mlog.String("post_id", post.Id),
				mlog.String("file_info_id", info.Id),
				mlog.String("file_info_path", info.Path),
				mlog.Err(err),
			)
			continue
		}

		savedInfos = append(savedInfos, info)
		fileIds = append(fileIds, info.Id)
	}

	// Copy and save the updated post
	newPost := &model.Post{}
	*newPost = *post

	newPost.Filenames = []string{}
	newPost.FileIds = fileIds

	// Update Posts to clear Filenames and set FileIds
	if _, err = a.Srv.Store.Post().Update(newPost, post); err != nil {
		mlog.Error(
			"Unable to save migrated post when migrating to use FileInfos",
			mlog.String("new_file_ids", strings.Join(newPost.FileIds, ",")),
			mlog.String("old_filenames", strings.Join(post.Filenames, ",")),
			mlog.String("post_id", post.Id),
			mlog.Err(err),
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
	if len(*a.Config().FileSettings.DriverName) == 0 {
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

func UploadFileSetTeamId(teamId string) func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.TeamId = filepath.Base(teamId)
	}
}

func UploadFileSetUserId(userId string) func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.UserId = filepath.Base(userId)
	}
}

func UploadFileSetTimestamp(timestamp time.Time) func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.Timestamp = timestamp
	}
}

func UploadFileSetContentLength(contentLength int64) func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.ContentLength = contentLength
	}
}

func UploadFileSetClientId(clientId string) func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.ClientId = clientId
	}
}

func UploadFileSetRaw() func(t *uploadFileTask) {
	return func(t *uploadFileTask) {
		t.Raw = true
	}
}

type uploadFileTask struct {
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
	saveToDatabase     func(*model.FileInfo) (*model.FileInfo, *model.AppError)
}

func (t *uploadFileTask) init(a *App) {
	t.buf = &bytes.Buffer{}
	t.maxFileSize = *a.Config().FileSettings.MaxFileSize
	t.limit = *a.Config().FileSettings.MaxFileSize

	t.fileinfo = model.NewInfo(filepath.Base(t.Name))
	t.fileinfo.Id = model.NewId()
	t.fileinfo.CreatorId = t.UserId
	t.fileinfo.CreateAt = t.Timestamp.UnixNano() / int64(time.Millisecond)
	t.fileinfo.Path = t.pathPrefix() + t.Name

	// Prepare to read ContentLength if it is known, otherwise limit
	// ourselves to MaxFileSize. Add an extra byte to check and fail if the
	// client sent too many bytes.
	if t.ContentLength > 0 {
		t.limit = t.ContentLength
		// Over-Grow the buffer to prevent bytes.ReadFrom from doing it
		// at the very end.
		t.buf.Grow(int(t.limit + 1 + bytes.MinRead))
	} else {
		// If we don't know the upload size, grow the buffer somewhat
		// anyway to avoid extra reslicing.
		t.buf.Grow(UploadFileInitialBufferSize)
	}
	t.limitedInput = &io.LimitedReader{
		R: t.Input,
		N: t.limit + 1,
	}
	t.teeInput = io.TeeReader(t.limitedInput, t.buf)

	t.pluginsEnvironment = a.GetPluginsEnvironment()
	t.writeFile = a.WriteFile
	t.saveToDatabase = a.Srv.Store.FileInfo().Save
}

// UploadFileX uploads a single file as specified in t. It applies the upload
// constraints, executes plugins and image processing logic as needed. It
// returns a filled-out FileInfo and an optional error. A plugin may reject the
// upload, returning a rejection error. In this case FileInfo would have
// contained the last "good" FileInfo before the execution of that plugin.
func (a *App) UploadFileX(channelId, name string, input io.Reader,
	opts ...func(*uploadFileTask)) (*model.FileInfo, *model.AppError) {

	t := &uploadFileTask{
		ChannelId: filepath.Base(channelId),
		Name:      filepath.Base(name),
		Input:     input,
	}
	for _, o := range opts {
		o(t)
	}
	t.init(a)

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, t.newAppError("api.file.upload_file.storage.app_error",
			"", http.StatusNotImplemented)
	}
	if t.ContentLength > t.maxFileSize {
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error",
			"", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
	}

	var aerr *model.AppError
	if !t.Raw && t.fileinfo.IsImage() {
		aerr = t.preprocessImage()
		if aerr != nil {
			return t.fileinfo, aerr
		}
	}

	aerr = t.readAll()
	if aerr != nil {
		return t.fileinfo, aerr
	}

	aerr = t.runPlugins()
	if aerr != nil {
		return t.fileinfo, aerr
	}

	// Concurrently upload and update DB, and post-process the image.
	wg := sync.WaitGroup{}

	if !t.Raw && t.fileinfo.IsImage() {
		wg.Add(1)
		go func() {
			t.postprocessImage()
			wg.Done()
		}()
	}

	_, aerr = t.writeFile(t.newReader(), t.fileinfo.Path)
	if aerr != nil {
		return nil, aerr
	}

	if _, err := t.saveToDatabase(t.fileinfo); err != nil {
		return nil, err
	}

	wg.Wait()

	return t.fileinfo, nil
}

func (t *uploadFileTask) readAll() *model.AppError {
	_, err := t.buf.ReadFrom(t.limitedInput)
	if err != nil {
		// Ugly hack: the error is not exported from net/http.
		if err.Error() == "http: request body too large" {
			return t.newAppError("api.file.upload_file.too_large_detailed.app_error",
				"", http.StatusRequestEntityTooLarge, "Length", t.buf.Len(), "Limit", t.limit)
		}
		return t.newAppError("api.file.upload_file.read_request.app_error",
			err.Error(), http.StatusBadRequest)
	}
	if int64(t.buf.Len()) > t.limit {
		return t.newAppError("api.file.upload_file.too_large_detailed.app_error",
			"", http.StatusRequestEntityTooLarge, "Length", t.buf.Len(), "Limit", t.limit)
	}
	t.fileinfo.Size = int64(t.buf.Len())

	t.limitedInput = nil
	t.teeInput = nil
	return nil
}

func (t *uploadFileTask) runPlugins() *model.AppError {
	if t.pluginsEnvironment == nil {
		return nil
	}

	pluginContext := &plugin.Context{}
	var rejectionError *model.AppError

	t.pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
		buf := &bytes.Buffer{}
		replacementInfo, rejectionReason := hooks.FileWillBeUploaded(pluginContext,
			t.fileinfo, t.newReader(), buf)
		if rejectionReason != "" {
			rejectionError = t.newAppError("api.file.upload_file.rejected_by_plugin.app_error",
				rejectionReason, http.StatusForbidden, "Reason", rejectionReason)
			return false
		}
		if replacementInfo != nil {
			t.fileinfo = replacementInfo
		}
		if buf.Len() != 0 {
			t.buf = buf
			t.teeInput = nil
			t.limitedInput = nil
			t.fileinfo.Size = int64(buf.Len())
		}

		return true
	}, plugin.FileWillBeUploadedId)

	if rejectionError != nil {
		return rejectionError
	}

	return nil
}

func (t *uploadFileTask) preprocessImage() *model.AppError {
	// If SVG, attempt to extract dimensions and then return
	if t.fileinfo.MimeType == "image/svg+xml" {
		svgInfo, err := parseSVG(t.newReader())
		if err != nil {
			mlog.Error("Failed to parse SVG", mlog.Err(err))
		}
		if svgInfo.Width > 0 && svgInfo.Height > 0 {
			t.fileinfo.Width = svgInfo.Width
			t.fileinfo.Height = svgInfo.Height
		}
		t.fileinfo.HasPreviewImage = false
		return nil
	}

	// If we fail to decode, return "as is".
	config, _, err := image.DecodeConfig(t.newReader())
	if err != nil {
		return nil
	}

	t.fileinfo.Width = config.Width
	t.fileinfo.Height = config.Height

	// Check dimensions before loading the whole thing into memory later on.
	if t.fileinfo.Width*t.fileinfo.Height > MaxImageSize {
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
	if t.imageOrientation, err = getImageOrientation(t.newReader()); err == nil &&
		(t.imageOrientation == RotatedCWMirrored ||
			t.imageOrientation == RotatedCCW ||
			t.imageOrientation == RotatedCCWMirrored ||
			t.imageOrientation == RotatedCW) {
		t.fileinfo.Width, t.fileinfo.Height = t.fileinfo.Height, t.fileinfo.Width
	}

	// For animated GIFs disable the preview; since we have to Decode gifs
	// anyway, cache the decoded image for later.
	if t.fileinfo.MimeType == "image/gif" {
		gifConfig, err := gif.DecodeAll(t.newReader())
		if err == nil {
			if len(gifConfig.Image) >= 1 {
				t.fileinfo.HasPreviewImage = false

			}
			if len(gifConfig.Image) > 0 {
				t.decoded = gifConfig.Image[0]
				t.imageType = "gif"
			}
		}
	}

	return nil
}

func (t *uploadFileTask) postprocessImage() {
	// don't try to process SVG files
	if t.fileinfo.MimeType == "image/svg+xml" {
		return
	}

	decoded, typ := t.decoded, t.imageType
	if decoded == nil {
		var err error
		decoded, typ, err = image.Decode(t.newReader())
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

	writeJPEG := func(img image.Image, path string) {
		r, w := io.Pipe()
		go func() {
			_, aerr := t.writeFile(r, path)
			if aerr != nil {
				mlog.Error("Unable to upload", mlog.String("path", path), mlog.Err(aerr))
				return
			}
		}()

		err := jpeg.Encode(w, img, &jpeg.Options{Quality: 90})
		if err != nil {
			mlog.Error("Unable to encode image as jpeg", mlog.String("path", path), mlog.Err(err))
			w.CloseWithError(err)
		} else {
			w.Close()
		}
	}

	w := decoded.Bounds().Dx()
	h := decoded.Bounds().Dy()

	wg := &sync.WaitGroup{}
	wg.Add(2)
	go func() {
		defer wg.Done()
		thumb := decoded
		if h > ImageThumbnailHeight || w > ImageThumbnailWidth {
			if float64(h)/float64(w) < ImageThumbnailRatio {
				thumb = imaging.Resize(decoded, 0, ImageThumbnailHeight, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(decoded, ImageThumbnailWidth, 0, imaging.Lanczos)
			}
		}
		writeJPEG(thumb, t.fileinfo.ThumbnailPath)
	}()

	go func() {
		defer wg.Done()
		preview := decoded
		if w > ImagePreviewWidth {
			preview = imaging.Resize(decoded, ImagePreviewWidth, 0, imaging.Lanczos)
		}
		writeJPEG(preview, t.fileinfo.PreviewPath)
	}()
	wg.Wait()
}

func (t uploadFileTask) newReader() io.Reader {
	if t.teeInput != nil {
		return io.MultiReader(bytes.NewReader(t.buf.Bytes()), t.teeInput)
	} else {
		return bytes.NewReader(t.buf.Bytes())
	}
}

func (t uploadFileTask) pathPrefix() string {
	return t.Timestamp.Format("20060102") +
		"/teams/" + t.TeamId +
		"/channels/" + t.ChannelId +
		"/users/" + t.UserId +
		"/" + t.fileinfo.Id + "/"
}

func (t uploadFileTask) newAppError(id string, details interface{}, httpStatus int, extra ...interface{}) *model.AppError {
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

	info, err := model.GetInfoForBytes(filename, data)
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
		if info.Width*info.Height > MaxImageSize {
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

	if _, err := a.Srv.Store.FileInfo().Save(info); err != nil {
		return nil, data, err
	}

	return info, data, nil
}

func (a *App) HandleImages(previewPathList []string, thumbnailPathList []string, fileData [][]byte) {
	wg := new(sync.WaitGroup)

	for i := range fileData {
		img, width, height := prepareImage(fileData[i])
		if img != nil {
			wg.Add(2)
			go func(img image.Image, path string, width int, height int) {
				defer wg.Done()
				a.generateThumbnailImage(img, path, width, height)
			}(img, thumbnailPathList[i], width, height)

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

func (a *App) generateThumbnailImage(img image.Image, thumbnailPath string, width int, height int) {
	thumbWidth := float64(IMAGE_THUMBNAIL_PIXEL_WIDTH)
	thumbHeight := float64(IMAGE_THUMBNAIL_PIXEL_HEIGHT)
	imgWidth := float64(width)
	imgHeight := float64(height)

	var thumbnail image.Image
	if imgHeight < IMAGE_THUMBNAIL_PIXEL_HEIGHT && imgWidth < thumbWidth {
		thumbnail = img
	} else if imgHeight/imgWidth < thumbHeight/thumbWidth {
		thumbnail = imaging.Resize(img, 0, IMAGE_THUMBNAIL_PIXEL_HEIGHT, imaging.Lanczos)
	} else {
		thumbnail = imaging.Resize(img, IMAGE_THUMBNAIL_PIXEL_WIDTH, 0, imaging.Lanczos)
	}

	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, thumbnail, &jpeg.Options{Quality: 90}); err != nil {
		mlog.Error("Unable to encode image as jpeg", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}

	if _, err := a.WriteFile(buf, thumbnailPath); err != nil {
		mlog.Error("Unable to upload thumbnail", mlog.String("path", thumbnailPath), mlog.Err(err))
		return
	}
}

func (a *App) generatePreviewImage(img image.Image, previewPath string, width int) {
	var preview image.Image

	if width > IMAGE_PREVIEW_PIXEL_WIDTH {
		preview = imaging.Resize(img, IMAGE_PREVIEW_PIXEL_WIDTH, 0, imaging.Lanczos)
	} else {
		preview = img
	}

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

func (a *App) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	return a.Srv.Store.FileInfo().Get(fileId)
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
		fileInfo, err := a.Srv.Store.FileInfo().Get(fileId)
		if err != nil {
			return nil, err
		}

		fileInfo.Id = model.NewId()
		fileInfo.CreatorId = userId
		fileInfo.CreateAt = now
		fileInfo.UpdateAt = now
		fileInfo.PostId = ""

		if _, err := a.Srv.Store.FileInfo().Save(fileInfo); err != nil {
			return newFileIds, err
		}

		newFileIds = append(newFileIds, fileInfo.Id)
	}

	return newFileIds, nil
}
