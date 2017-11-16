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

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"

	"github.com/mattermost/mattermost-server/model"
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
	IMAGE_PREVIEW_PIXEL_WIDTH    = 1024
)

func (a *App) FileBackend() (utils.FileBackend, *model.AppError) {
	return utils.NewFileBackend(&a.Config().FileSettings)
}

func (a *App) ReadFile(path string) ([]byte, *model.AppError) {
	backend, err := a.FileBackend()
	if err != nil {
		return nil, err
	}
	return backend.ReadFile(path)
}

func (a *App) MoveFile(oldPath, newPath string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	return backend.MoveFile(oldPath, newPath)
}

func (a *App) WriteFile(f []byte, path string) *model.AppError {
	backend, err := a.FileBackend()
	if err != nil {
		return err
	}
	return backend.WriteFile(f, path)
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
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.unexpected_filename.error"), post.Id, filename)
		return nil
	}

	channelId := split[1]
	userId := split[2]
	oldId := split[3]
	name, _ := url.QueryUnescape(split[4])

	if split[0] != "" || split[1] != post.ChannelId || split[2] != post.UserId || strings.Contains(split[4], "/") {
		l4g.Warn(utils.T("api.file.migrate_filenames_to_file_infos.mismatched_filename.warn"), post.Id, post.ChannelId, post.UserId, filename)
	}

	pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamId, channelId, userId, oldId)
	path := pathPrefix + name

	// Open the file and populate the fields of the FileInfo
	var info *model.FileInfo
	if data, err := a.ReadFile(path); err != nil {
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.file_not_found.error"), post.Id, filename, path, err)
		return nil
	} else {
		var err *model.AppError
		info, err = model.GetInfoForBytes(name, data)
		if err != nil {
			l4g.Warn(utils.T("api.file.migrate_filenames_to_file_infos.info.app_error"), post.Id, filename, err)
		}
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
	if result := <-a.Srv.Store.Team().GetTeamsByUserId(post.UserId); result.Err != nil {
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.teams.app_error"), post.Id, result.Err)
	} else if teams := result.Data.([]*model.Team); len(teams) == 1 {
		// The user has only one team so the post must've been sent from it
		return teams[0].Id
	} else {
		for _, team := range teams {
			path := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", team.Id, post.ChannelId, post.UserId, id, name)
			if _, err := a.ReadFile(path); err == nil {
				// Found the team that this file was posted from
				return team.Id
			}
		}
	}

	return ""
}

var fileMigrationLock sync.Mutex

// Creates and stores FileInfos for a post created before the FileInfos table existed.
func (a *App) MigrateFilenamesToFileInfos(post *model.Post) []*model.FileInfo {
	if len(post.Filenames) == 0 {
		l4g.Warn(utils.T("api.file.migrate_filenames_to_file_infos.no_filenames.warn"), post.Id)
		return []*model.FileInfo{}
	}

	cchan := a.Srv.Store.Channel().Get(post.ChannelId, true)

	// There's a weird bug that rarely happens where a post ends up with duplicate Filenames so remove those
	filenames := utils.RemoveDuplicatesFromStringArray(post.Filenames)

	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.channel.app_error"), post.Id, post.ChannelId, result.Err)
		return []*model.FileInfo{}
	} else {
		channel = result.Data.(*model.Channel)
	}

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
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.team_id.error"), post.Id, filenames)
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

	if result := <-a.Srv.Store.Post().Get(post.Id); result.Err != nil {
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.get_post_again.app_error"), post.Id, result.Err)
		return []*model.FileInfo{}
	} else if newPost := result.Data.(*model.PostList).Posts[post.Id]; len(newPost.Filenames) != len(post.Filenames) {
		// Another thread has already created FileInfos for this post, so just return those
		if result := <-a.Srv.Store.FileInfo().GetForPost(post.Id, true, false); result.Err != nil {
			l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.get_post_file_infos_again.app_error"), post.Id, result.Err)
			return []*model.FileInfo{}
		} else {
			l4g.Debug(utils.T("api.file.migrate_filenames_to_file_infos.not_migrating_post.debug"), post.Id)
			return result.Data.([]*model.FileInfo)
		}
	}

	l4g.Debug(utils.T("api.file.migrate_filenames_to_file_infos.migrating_post.debug"), post.Id)

	savedInfos := make([]*model.FileInfo, 0, len(infos))
	fileIds := make([]string, 0, len(filenames))
	for _, info := range infos {
		if result := <-a.Srv.Store.FileInfo().Save(info); result.Err != nil {
			l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.save_file_info.app_error"), post.Id, info.Id, info.Path, result.Err)
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
		l4g.Error(utils.T("api.file.migrate_filenames_to_file_infos.save_post.app_error"), post.Id, newPost.FileIds, post.Filenames, result.Err)
		return []*model.FileInfo{}
	} else {
		return savedInfos
	}
}

func (a *App) GeneratePublicLink(siteURL string, info *model.FileInfo) string {
	hash := GeneratePublicLinkHash(info.Id, *a.Config().FileSettings.PublicLinkSalt)
	return fmt.Sprintf("%s/files/%v/public?h=%s", siteURL, info.Id, hash)
}

func (a *App) GeneratePublicLinkV3(siteURL string, info *model.FileInfo) string {
	hash := GeneratePublicLinkHash(info.Id, *a.Config().FileSettings.PublicLinkSalt)
	return fmt.Sprintf("%s%s/public/files/%v/get?h=%s", siteURL, model.API_URL_SUFFIX_V3, info.Id, hash)
}

func GeneratePublicLinkHash(fileId, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(salt))
	hash.Write([]byte(fileId))

	return base64.RawURLEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) UploadFiles(teamId string, channelId string, userId string, fileHeaders []*multipart.FileHeader, clientIds []string) (*model.FileUploadResponse, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("uploadFile", "api.file.upload_file.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	resStruct := &model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	previewPathList := []string{}
	thumbnailPathList := []string{}
	imageDataList := [][]byte{}

	for i, fileHeader := range fileHeaders {
		file, fileErr := fileHeader.Open()
		if fileErr != nil {
			return nil, model.NewAppError("UploadFiles", "api.file.upload_file.bad_parse.app_error", nil, fileErr.Error(), http.StatusBadRequest)
		}
		defer file.Close()

		buf := bytes.NewBuffer(nil)
		io.Copy(buf, file)
		data := buf.Bytes()

		info, err := a.DoUploadFile(time.Now(), teamId, channelId, userId, fileHeader.Filename, data)
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
	filename := filepath.Base(rawFilename)
	teamId := filepath.Base(rawTeamId)
	channelId := filepath.Base(rawChannelId)
	userId := filepath.Base(rawUserId)

	info, err := model.GetInfoForBytes(filename, data)
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, err
	}

	info.Id = model.NewId()
	info.CreatorId = userId

	pathPrefix := now.Format("20060102") + "/teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + info.Id + "/"
	info.Path = pathPrefix + filename

	if info.IsImage() {
		// Check dimensions before loading the whole thing into memory later on
		if info.Width*info.Height > MaxImageSize {
			err := model.NewAppError("uploadFile", "api.file.upload_file.large_image.app_error", map[string]interface{}{"Filename": filename}, "", http.StatusBadRequest)
			return nil, err
		}

		nameWithoutExtension := filename[:strings.LastIndex(filename, ".")]
		info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview.jpg"
		info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb.jpg"
	}

	if err := a.WriteFile(data, info.Path); err != nil {
		return nil, err
	}

	if result := <-a.Srv.Store.FileInfo().Save(info); result.Err != nil {
		return nil, result.Err
	}

	return info, nil
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
		l4g.Error(utils.T("api.file.handle_images_forget.decode.error"), err)
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
	if exifData, err := exif.Decode(input); err != nil {
		return Upright, err
	} else {
		if tag, err := exifData.Get("Orientation"); err != nil {
			return Upright, err
		} else {
			orientation, err := tag.Int(0)
			if err != nil {
				return Upright, err
			} else {
				return orientation, nil
			}
		}
	}
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
		l4g.Error(utils.T("api.file.handle_images_forget.encode_jpeg.error"), thumbnailPath, err)
		return
	}

	if err := a.WriteFile(buf.Bytes(), thumbnailPath); err != nil {
		l4g.Error(utils.T("api.file.handle_images_forget.upload_thumb.error"), thumbnailPath, err)
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
		l4g.Error(utils.T("api.file.handle_images_forget.encode_preview.error"), previewPath, err)
		return
	}

	if err := a.WriteFile(buf.Bytes(), previewPath); err != nil {
		l4g.Error(utils.T("api.file.handle_images_forget.upload_preview.error"), previewPath, err)
		return
	}
}

func (a *App) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	if result := <-a.Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.FileInfo), nil
	}
}
