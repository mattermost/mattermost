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
	_ "image/gif"
	"image/jpeg"
	"io"
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

	MaxImageSize                 = 6048 * 4032 // 24 megapixels, roughly 36MB as a raw image
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
			return nil, model.NewAppError("UploadFiles", "api.file.upload_file.bad_parse.app_error", nil, fileErr.Error(), http.StatusBadRequest)
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
		return nil, model.NewAppError("uploadFile", "api.file.upload_file.storage.app_error", nil, "", http.StatusNotImplemented)
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

func (a *App) DoUploadFile(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError) {
	info, _, err := a.DoUploadFileExpectModification(now, rawTeamId, rawChannelId, rawUserId, rawFilename, data)
	return info, err
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

	if a.PluginsReady() {
		var rejectionError *model.AppError
		pluginContext := &plugin.Context{}
		a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
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
			go func(img *image.Image, path string, width int, height int) {
				defer wg.Done()
				a.generateThumbnailImage(*img, path, width, height)
			}(img, thumbnailPathList[i], width, height)

			go func(img *image.Image, path string, width int) {
				defer wg.Done()
				a.generatePreviewImage(*img, path, width)
			}(img, previewPathList[i], width)
		}
	}
	wg.Wait()
}

func prepareImage(fileData []byte) (*image.Image, int, int) {
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

	return &img, width, height
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
