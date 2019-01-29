// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/filesstore"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
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
func (a *App) FileReader(path string) (io.ReadCloser, *model.AppError) {
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

func (a *App) GetInfoForFilename(post *model.Post, teamId string, filename string) *model.FileInfo {
	// Find the path from the Filename of the form /{channelId}/{userId}/{uid}/{nameWithExtension}
	split := strings.SplitN(filename, "/", 5)
	if len(split) < 5 {
		mlog.Error("Unable to decipher filename when migrating post to use FileInfos", mlog.String("post_id", post.Id), mlog.String("filename", filename))
		return nil
	}

	channelId := split[1]
	userId := split[2]
	oldId := split[3]
	name, _ := url.QueryUnescape(split[4])

	if split[0] != "" || split[1] != post.ChannelId || split[2] != post.UserId || strings.Contains(split[4], "/") {
		mlog.Warn(
			"Found an unusual filename when migrating post to use FileInfos",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.String("user_id", post.UserId),
			mlog.String("filename", filename),
		)
	}

	pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamId, channelId, userId, oldId)
	path := pathPrefix + name

	// Open the file and populate the fields of the FileInfo
	data, err := a.ReadFile(path)
	if err != nil {
		mlog.Error(
			fmt.Sprintf("File not found when migrating post to use FileInfos, err=%v", err),
			mlog.String("post_id", post.Id),
			mlog.String("filename", filename),
			mlog.String("path", path),
		)
		return nil
	}

	info, err := model.GetInfoForBytes(name, data)
	if err != nil {
		mlog.Warn(
			fmt.Sprintf("Unable to fully decode file info when migrating post to use FileInfos, err=%v", err),
			mlog.String("post_id", post.Id),
			mlog.String("filename", filename),
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

func (a *App) FindTeamIdForFilename(post *model.Post, filename string) string {
	split := strings.SplitN(filename, "/", 5)
	id := split[3]
	name, _ := url.QueryUnescape(split[4])

	// This post is in a direct channel so we need to figure out what team the files are stored under.
	result := <-a.Srv.Store.Team().GetTeamsByUserId(post.UserId)
	if result.Err != nil {
		mlog.Error(fmt.Sprintf("Unable to get teams when migrating post to use FileInfo, err=%v", result.Err), mlog.String("post_id", post.Id))
		return ""
	}

	teams := result.Data.([]*model.Team)
	if len(teams) == 1 {
		// The user has only one team so the post must've been sent from it
		return teams[0].Id
	}

	for _, team := range teams {
		path := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", team.Id, post.ChannelId, post.UserId, id, name)
		if _, err := a.ReadFile(path); err == nil {
			// Found the team that this file was posted from
			return team.Id
		}
	}

	return ""
}

var fileMigrationLock sync.Mutex

// Creates and stores FileInfos for a post created before the FileInfos table existed.
func (a *App) MigrateFilenamesToFileInfos(post *model.Post) []*model.FileInfo {
	if len(post.Filenames) == 0 {
		mlog.Warn("Unable to migrate post to use FileInfos with an empty Filenames field", mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	cchan := a.Srv.Store.Channel().Get(post.ChannelId, true)

	// There's a weird bug that rarely happens where a post ends up with duplicate Filenames so remove those
	filenames := utils.RemoveDuplicatesFromStringArray(post.Filenames)

	result := <-cchan
	if result.Err != nil {
		mlog.Error(
			fmt.Sprintf("Unable to get channel when migrating post to use FileInfos, err=%v", result.Err),
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
		)
		return []*model.FileInfo{}
	}
	channel := result.Data.(*model.Channel)

	// Find the team that was used to make this post since its part of the file path that isn't saved in the Filename
	var teamId string
	if channel.TeamId == "" {
		// This post was made in a cross-team DM channel so we need to find where its files were saved
		teamId = a.FindTeamIdForFilename(post, filenames[0])
	} else {
		teamId = channel.TeamId
	}

	// Create FileInfo objects for this post
	infos := make([]*model.FileInfo, 0, len(filenames))
	if teamId == "" {
		mlog.Error(
			fmt.Sprintf("Unable to find team id for files when migrating post to use FileInfos, filenames=%v", filenames),
			mlog.String("post_id", post.Id),
		)
	} else {
		for _, filename := range filenames {
			info := a.GetInfoForFilename(post, teamId, filename)
			if info == nil {
				continue
			}

			infos = append(infos, info)
		}
	}

	// Lock to prevent only one migration thread from trying to update the post at once, preventing duplicate FileInfos from being created
	fileMigrationLock.Lock()
	defer fileMigrationLock.Unlock()

	result = <-a.Srv.Store.Post().Get(post.Id)
	if result.Err != nil {
		mlog.Error(fmt.Sprintf("Unable to get post when migrating post to use FileInfos, err=%v", result.Err), mlog.String("post_id", post.Id))
		return []*model.FileInfo{}
	}

	if newPost := result.Data.(*model.PostList).Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		result := <-a.Srv.Store.FileInfo().GetForPost(post.Id, true, false)
		if result.Err != nil {
			mlog.Error(fmt.Sprintf("Unable to get FileInfos for migrated post, err=%v", result.Err), mlog.String("post_id", post.Id))
			return []*model.FileInfo{}
		}

		mlog.Debug("Post already migrated to use FileInfos", mlog.String("post_id", post.Id))
		return result.Data.([]*model.FileInfo)
	}

	mlog.Debug("Migrating post to use FileInfos", mlog.String("post_id", post.Id))

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIds := make([]string, 0, len(filenames))
	for _, info := range infos {
		if result := <-a.Srv.Store.FileInfo().Save(info); result.Err != nil {
			mlog.Error(
				fmt.Sprintf("Unable to save file info when migrating post to use FileInfos, err=%v", result.Err),
				mlog.String("post_id", post.Id),
				mlog.String("file_info_id", info.Id),
				mlog.String("file_info_path", info.Path),
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
	if result := <-a.Srv.Store.Post().Update(newPost, post); result.Err != nil {
		mlog.Error(fmt.Sprintf("Unable to save migrated post when migrating to use FileInfos, new_file_ids=%v, old_filenames=%v, err=%v", newPost.FileIds, post.Filenames, result.Err), mlog.String("post_id", post.Id))
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
	// the file. If the mime type of the file is that of an image, assign
	// it generic thumbnail and preview URLs. Plugins are still invoked.
	// TODO assign generic preview/thumb URLs to Raw images
	Raw bool

	//=============================================================
	// Internal state

	// Overall, the upload is handled is
	//  1. Pre-process images (headers, orientation, etc.). Pre-read from
	//     the input as much as needed.
	//  2. Run Plugins. Upon the first actual invocation drain the input
	//     and buffer the payload. The payload may be replaced by the
	//     plugins.
	//  3. Post-process images: generate and upload preview and thumbnail
	//     versions.
	//  4. Write the payload to the store and update the database
	//
	// For preprocessing (#1), we setup a pipe of nested io.Readers:
	//     Input |
	//     sizeLimitedInput |
	//     (memoryLimitedInput) |
	//     memoryLimitedTeeInput
	//         |-> preprocessImage
	//         |-> lbuf
	//
	// In the first plugin invocation (#2), drain memoryLimitedTeeInput, then
	// drain sizeLimitedInput directly into lbuf, buffering the entire
	// allowed payload there. Close (flush!) lbuf. Plugins may replace lbuf.
	//
	// Post-process images and save (#3,#4) to the file store out of lbuf

	sizeLimitExceeded     bool
	lbuf                  *utils.LargeBuffer
	sizeLimitedInput      io.Reader
	memoryLimitedTeeInput io.Reader
	bytesRead             int64
	maxFileSize           int64
	maxMemoryBuffer       int

	fileinfo *model.FileInfo

	// Cached image data that (may) get initialized in preprocessImage and
	// is used in postprocessImage
	decoded            image.Image
	imageType          string
	imageIsTooLarge    bool
	imageOrientation   int
	pluginsEnvironment *plugin.Environment
	pluginContext      *plugin.Context

	// Testing: overrideable dependency functions
	writeFile      func(io.Reader, string) (int64, *model.AppError)
	saveToDatabase func(*model.FileInfo) store.StoreChannel
}

func (t *uploadFileTask) init(a *App) {
	t.maxFileSize = *a.Config().FileSettings.MaxFileSize
	t.maxMemoryBuffer = int(*a.Config().FileSettings.MaxMemoryBuffer)
	t.lbuf = utils.NewLargeBuffer(t.maxMemoryBuffer, "base64")

	t.fileinfo = model.NewInfo(filepath.Base(t.Name))
	t.fileinfo.Id = model.NewId()
	t.fileinfo.CreatorId = t.UserId
	if t.Timestamp.IsZero() {
		t.Timestamp = time.Now()
	}
	t.fileinfo.CreateAt = t.Timestamp.UnixNano() / int64(time.Millisecond)
	t.fileinfo.Path = t.pathPrefix() + t.Name

	// t.sizeLimitedInput will error if the length of the upload exceeds
	// the MaxSize limit, or its stated ContentLength, whichever is less.
	// Add an extra byte to check and fail if the client sent too many
	// bytes.
	limit := t.maxFileSize
	if t.ContentLength > 0 && t.ContentLength < t.maxFileSize {
		limit = t.ContentLength + 1
	}
	t.sizeLimitedInput = &utils.LimitedReader{
		R: t.Input,
		N: limit,
		LimitReached: func(l *utils.LimitedReader) error {
			t.sizeLimitExceeded = true
			return fmt.Errorf("Entity too large: %v bytes, limit: %v bytes", l.BytesRead, limit)
		},
	}

	// memoryLimitedTeeInput will stop at t.maxMemoryBuffer (io.EOF). It also sets
	// imageRaw flag to disable post-processing and assign generic
	// thumbnail/preview URLs. It copies everything that is read from it to lbuf.
	t.memoryLimitedTeeInput = io.TeeReader(&utils.LimitedReader{
		R: t.sizeLimitedInput,
		N: int64(t.maxMemoryBuffer),
		LimitReached: func(l *utils.LimitedReader) error {
			t.imageIsTooLarge = true
			return io.EOF
		},
	}, t.lbuf)

	t.pluginsEnvironment = a.GetPluginsEnvironment()
	t.pluginContext = a.PluginContext()

	t.writeFile = a.WriteFile
	t.saveToDatabase = a.Srv.Store.FileInfo().Save
}

// UploadFileX uploads a single file as specified in t. It applies the upload
// constraints, executes plugins and image processing logic as needed. It
// returns a filled-out FileInfo and an optional error. A plugin may reject the
// upload, returning a rejection error. In this case FileInfo would have
// contained the last "good" FileInfo before the execution of that plugin.
func (a *App) UploadFileX(channelId, name string, input io.Reader,
	opts ...func(*uploadFileTask)) (resultFileinfo *model.FileInfo, resultError *model.AppError) {
	var aerr *model.AppError

	t := &uploadFileTask{
		ChannelId: filepath.Base(channelId),
		Name:      filepath.Base(name),
		Input:     input,
	}
	for _, o := range opts {
		o(t)
	}
	t.init(a)
	defer t.lbuf.Clear()

	// We may run into the entityTooLarge error in a Read() call, it
	// results in a premature EOF, and there's no way to return the desired
	// AppError. So we set the flag when it happens, and check it before we
	// return. Note that EntityTooLarge should override whatever indirect
	// error code it caused.
	defer func() {
		if t.sizeLimitExceeded {
			resultError = t.newAppError("api.file.upload_file.too_large_detailed.app_error",
				"", http.StatusRequestEntityTooLarge)
			resultFileinfo = nil
		}
	}()

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, t.newAppError("api.file.upload_file.storage.app_error",
			"", http.StatusNotImplemented)
	}
	if t.ContentLength > t.maxFileSize {
		return nil, t.newAppError("api.file.upload_file.too_large_detailed.app_error",
			"", http.StatusRequestEntityTooLarge, "Length", t.ContentLength, "Limit", t.maxFileSize)
	}

	if t.needProcessImage() {
		aerr = t.preprocessImage()
		if aerr != nil {
			return nil, aerr
		}
	}

	aerr = t.runPlugins()
	if aerr != nil {
		return nil, aerr
	}

	// No need to buffer after plugins have run
	aerr = t.stopBuffering()
	if aerr != nil {
		return nil, aerr
	}

	// Concurrently upload/update DB, and post-process the image.  Achieve
	// it by tee-ing the input into a pipe as we are uploading it to the
	// file store. Image post-processing is on the receiving end of the
	// pipe.  This way the entire file is always uploaded, even if image
	// decoding terminates early.
	var pr *io.PipeReader
	var pw *io.PipeWriter
	var writeError *model.AppError
	wg := sync.WaitGroup{}

	input, closer, aerr := t.newCombinedReadCloser()
	if aerr != nil {
		return nil, aerr
	}
	defer closer.Close()

	if t.needProcessImage() && t.decoded == nil {
		// Set up for concurrent image decoding if needed
		pr, pw = io.Pipe()
		input = io.TeeReader(input, pw)
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		var size int64
		size, writeError = t.writeFile(input, t.fileinfo.Path)
		if pw != nil {
			pw.Close()
		}
		if writeError != nil {
			return
		}

		// Use the actual byte count written
		t.fileinfo.Size = size
		result := <-t.saveToDatabase(t.fileinfo)
		if result.Err != nil {
			writeError = result.Err
			return
		}
	}()

	if t.needProcessImage() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if t.decoded == nil {
				t.decodeImage(pr)
				// Fully drain the pipe reader.
				io.Copy(ioutil.Discard, pr)
			}
			t.postprocessImage()
		}()
	}

	wg.Wait()
	if writeError != nil {
		return nil, writeError
	}

	return t.fileinfo, nil
}

func (t *uploadFileTask) stopBuffering() *model.AppError {
	t.memoryLimitedTeeInput = nil
	err := t.lbuf.Close()
	if err != nil {
		return t.newAppError("api.file.upload_file.read_request.app_error",
			err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (t *uploadFileTask) runPlugins() *model.AppError {
	if t.pluginsEnvironment == nil {
		return nil
	}

	var rejectionError *model.AppError
	t.pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
		rejectionError = t.runPlugin(hooks)
		return rejectionError == nil && !t.sizeLimitExceeded
	}, plugin.FileWillBeUploadedId)

	return rejectionError
}

// runPlugin will only get invoked if there is indeed a FileWillBeUploaded hook
// registered by an active plugin. The first time it's invoked, need to fully
// buffer the input since the plugin may consume it and not return a
// replacement.
func (t *uploadFileTask) runPlugin(hooks plugin.Hooks) *model.AppError {
	if t.sizeLimitedInput != nil {
		_, err := io.Copy(t.lbuf, t.sizeLimitedInput)
		if err != nil {
			return t.newAppError("api.file.upload_file.read_request.app_error",
				err.Error(), http.StatusBadRequest)
		}

		t.sizeLimitedInput = nil
		appErr := t.stopBuffering()
		if appErr != nil {
			return appErr
		}
	}

	newLbuf := &utils.LargeBuffer{}
	newFileinfo, rejection := hooks.FileWillBeUploaded(t.pluginContext,
		t.fileinfo,
		&plugin.FileWillBeUploadedWrapper{P: t.lbuf},
		&plugin.FileWillBeUploadedWrapper{P: newLbuf},
	)
	if rejection != "" {
		return t.newAppError("api.file.upload_file.read_request.app_error",
			"File rejected by plugin. "+rejection, http.StatusBadRequest)
	}
	if newFileinfo != nil {
		t.fileinfo = newFileinfo
	}
	if !newLbuf.IsEmpty() {
		err := t.lbuf.Close()
		if err != nil {
			return t.newAppError("api.file.upload_file.read_request.app_error",
				err.Error(), http.StatusBadRequest)
		}
		t.lbuf.Clear()
		t.lbuf = newLbuf
		t.memoryLimitedTeeInput = nil
		t.sizeLimitedInput = nil
	}
	return nil
}

func (t *uploadFileTask) preprocessImage() *model.AppError {
	// If we fail to decode, return "as is".
	config, _, err := image.DecodeConfig(t.newMemoryBufferReader())
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

	// TODO: try to reuse exif's .Raw buffer rather than Tee-ing
	if t.imageOrientation, err = getImageOrientation(t.newMemoryBufferReader()); err == nil &&
		(t.imageOrientation == RotatedCWMirrored ||
			t.imageOrientation == RotatedCCW ||
			t.imageOrientation == RotatedCCWMirrored ||
			t.imageOrientation == RotatedCW) {
		t.fileinfo.Width, t.fileinfo.Height = t.fileinfo.Height, t.fileinfo.Width
	}

	// For animated GIFs disable the preview; since we have to Decode gifs
	// anyway, cache the decoded image for later.
	if t.fileinfo.MimeType == "image/gif" {
		gifConfig, err := gif.DecodeAll(t.newMemoryBufferReader())
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

func (t *uploadFileTask) needProcessImage() bool {
	return !t.Raw && t.fileinfo.IsImage() && !t.imageIsTooLarge
}

func (t *uploadFileTask) decodeImage(in io.Reader) {
	decoded, typ := t.decoded, t.imageType
	if decoded == nil {
		var err error
		decoded, typ, err = image.Decode(in)
		if err != nil {
			mlog.Error(fmt.Sprintf("Unable to decode image err=%v", err))
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
	t.decoded = decoded
}

func (t *uploadFileTask) postprocessImage() {
	decoded := t.decoded
	if decoded == nil {
		return
	}

	writeJPEG := func(img image.Image, path string) {
		r, w := io.Pipe()
		go func() {
			_, aerr := t.writeFile(r, path)
			if aerr != nil {
				mlog.Error(fmt.Sprintf("Unable to upload path=%v err=%v", path, aerr))
				return
			}
		}()

		err := jpeg.Encode(w, img, &jpeg.Options{Quality: 90})
		if err != nil {
			mlog.Error(fmt.Sprintf("Unable to encode image as jpeg path=%v err=%v", path, err))
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

func (t uploadFileTask) newMemoryBufferReader() io.Reader {
	var r io.Reader = bytes.NewReader(t.lbuf.Bytes())
	if t.memoryLimitedTeeInput != nil {
		// We are still operating in the memory buffer
		r = io.MultiReader(r, t.memoryLimitedTeeInput)
	}
	return r
}

func (t uploadFileTask) newCombinedReadCloser() (io.Reader, io.Closer, *model.AppError) {
	// First, read from the buffer
	buffered, err := t.lbuf.NewReadCloser()
	if err != nil {
		return nil, nil, t.newAppError("api.file.upload_file.read_request.app_error",
			err.Error(), http.StatusInternalServerError)
	}

	if t.sizeLimitedInput == nil {
		return buffered, buffered, nil
	}

	var unread io.Reader
	if t.memoryLimitedTeeInput != nil {
		unread = t.memoryLimitedTeeInput
	} else {
		unread = t.sizeLimitedInput
	}

	return io.MultiReader(buffered, unread), buffered, nil
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

	if result := <-a.Srv.Store.FileInfo().Save(info); result.Err != nil {
		return nil, data, result.Err
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
		mlog.Error(fmt.Sprintf("Unable to decode image err=%v", err))
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
		mlog.Error(fmt.Sprintf("Unable to encode image as jpeg path=%v err=%v", thumbnailPath, err))
		return
	}

	if _, err := a.WriteFile(buf, thumbnailPath); err != nil {
		mlog.Error(fmt.Sprintf("Unable to upload thumbnail path=%v err=%v", thumbnailPath, err))
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
		mlog.Error(fmt.Sprintf("Unable to encode image as preview jpg err=%v", err), mlog.String("path", previewPath))
		return
	}

	if _, err := a.WriteFile(buf, previewPath); err != nil {
		mlog.Error(fmt.Sprintf("Unable to upload preview err=%v", err), mlog.String("path", previewPath))
		return
	}
}

func (a *App) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	result := <-a.Srv.Store.FileInfo().Get(fileId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.FileInfo), nil
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
		result := <-a.Srv.Store.FileInfo().Get(fileId)

		if result.Err != nil {
			return nil, result.Err
		}

		fileInfo := result.Data.(*model.FileInfo)
		fileInfo.Id = model.NewId()
		fileInfo.CreatorId = userId
		fileInfo.CreateAt = now
		fileInfo.UpdateAt = now
		fileInfo.PostId = ""

		if result := <-a.Srv.Store.FileInfo().Save(fileInfo); result.Err != nil {
			return newFileIds, result.Err
		}

		newFileIds = append(newFileIds, fileInfo.Id)
	}

	return newFileIds, nil
}
