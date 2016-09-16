// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

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
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"
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

	MaxImageSize = 6048 * 4032 // 24 megapixels, roughly 36MB as a raw image
)

var fileInfoCache *utils.Cache = utils.NewLru(1000)

func InitFile() {
	l4g.Debug(utils.T("api.file.init.debug"))

	BaseRoutes.TeamFiles.Handle("/upload", ApiUserRequired(uploadFile)).Methods("POST")

	BaseRoutes.NeedFile.Handle("/get", ApiUserRequiredTrustRequester(getFile)).Methods("GET")
	BaseRoutes.NeedFile.Handle("/get_thumbnail", ApiUserRequiredTrustRequester(getFileThumbnail)).Methods("GET")
	BaseRoutes.NeedFile.Handle("/get_preview", ApiUserRequiredTrustRequester(getFilePreview)).Methods("GET")
	BaseRoutes.NeedFile.Handle("/get_info", ApiUserRequired(getFileInfo)).Methods("GET")
	BaseRoutes.NeedFile.Handle("/get_public_link", ApiUserRequired(getPublicLink)).Methods("GET")

	BaseRoutes.Public.Handle("/files/{file_id:[A-Za-z0-9]+}/get", ApiAppHandlerTrustRequesterIndependent(getPublicFile)).Methods("GET")
	BaseRoutes.Public.Handle("/files/get/{team_id:[A-Za-z0-9]+}/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+(\\.[A-Za-z0-9]{3,})?}", ApiAppHandlerTrustRequesterIndependent(getPublicFileOld)).Methods("GET")
}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if r.ContentLength > *utils.Cfg.FileSettings.MaxFileSize {
		c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	props := m.Value
	if len(props["channel_id"]) == 0 {
		c.SetInvalidParam("uploadFile", "channel_id")
		return
	}
	channelId := props["channel_id"][0]
	if len(channelId) == 0 {
		c.SetInvalidParam("uploadFile", "channel_id")
		return
	}

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_UPLOAD_FILE) {
		return
	}

	resStruct := &model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	previewPathList := []string{}
	thumbnailPathList := []string{}
	imageDataList := [][]byte{}

	for i, fileHeader := range m.File["files"] {
		file, fileErr := fileHeader.Open()
		defer file.Close()
		if fileErr != nil {
			http.Error(w, fileErr.Error(), http.StatusInternalServerError)
			return
		}

		buf := bytes.NewBuffer(nil)
		io.Copy(buf, file)

		info, err := model.GetInfoForBytes(fileHeader.Filename, buf.Bytes())
		if err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		info.Id = model.NewId()
		info.UserId = c.Session.UserId

		filename := filepath.Base(fileHeader.Filename)
		pathPrefix := "teams/" + c.TeamId + "/channels/" + channelId + "/users/" + c.Session.UserId + "/" + info.Id + "/"

		info.Path = pathPrefix + filename

		if info.IsImage() {
			// Check dimensions before loading the whole thing into memory later on
			if info.Width*info.Height > MaxImageSize {
				c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.large_image.app_error", nil, c.T("api.file.file_upload.exceeds"))
				c.Err.StatusCode = http.StatusBadRequest
				return
			}

			nameWithoutExtension := filename[:strings.LastIndex(filename, ".")]
			info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview.jpg"
			info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb.jpg"
			previewPathList = append(previewPathList, info.PreviewPath)
			thumbnailPathList = append(thumbnailPathList, info.ThumbnailPath)
			imageDataList = append(imageDataList, buf.Bytes())
		}

		if err := utils.WriteFile(buf.Bytes(), info.Path); err != nil {
			c.Err = err
			return
		}

		if result := <-Srv.Store.FileInfo().Save(info); result.Err != nil {
			c.Err = result.Err
			return
		}

		resStruct.FileInfos = append(resStruct.FileInfos, info)

		if len(m.Value["client_ids"]) > 0 {
			resStruct.ClientIds = append(resStruct.ClientIds, m.Value["client_ids"][i])
		}
	}

	go handleImages(previewPathList, thumbnailPathList, imageDataList)

	w.Write([]byte(resStruct.ToJson()))
}

func handleImages(previewPathList []string, thumbnailPathList []string, fileData [][]byte) {
	for i := range fileData {
		go func() {
			thumbnailPath := thumbnailPathList[i]

			// Decode image bytes into Image object
			img, imgType, err := image.Decode(bytes.NewReader(fileData[i]))
			if err != nil {
				l4g.Error(utils.T("api.file.handle_images_forget.decode.error"), err)
				return
			}

			width := img.Bounds().Dx()
			height := img.Bounds().Dy()

			// Get the image's orientation and ignore any errors since not all images will have orientation data
			orientation, _ := getImageOrientation(fileData[i])

			if imgType == "png" {
				dst := image.NewRGBA(img.Bounds())
				draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
				draw.Draw(dst, dst.Bounds(), img, img.Bounds().Min, draw.Over)
				img = dst
			}

			switch orientation {
			case UprightMirrored:
				img = imaging.FlipH(img)
			case UpsideDown:
				img = imaging.Rotate180(img)
			case UpsideDownMirrored:
				img = imaging.FlipV(img)
			case RotatedCWMirrored:
				img = imaging.Transpose(img)
			case RotatedCCW:
				img = imaging.Rotate270(img)
			case RotatedCCWMirrored:
				img = imaging.Transverse(img)
			case RotatedCW:
				img = imaging.Rotate90(img)
			}

			// Create thumbnail
			go func() {
				thumbWidth := float64(utils.Cfg.FileSettings.ThumbnailWidth)
				thumbHeight := float64(utils.Cfg.FileSettings.ThumbnailHeight)
				imgWidth := float64(width)
				imgHeight := float64(height)

				var thumbnail image.Image
				if imgHeight < thumbHeight && imgWidth < thumbWidth {
					thumbnail = img
				} else if imgHeight/imgWidth < thumbHeight/thumbWidth {
					thumbnail = imaging.Resize(img, 0, utils.Cfg.FileSettings.ThumbnailHeight, imaging.Lanczos)
				} else {
					thumbnail = imaging.Resize(img, utils.Cfg.FileSettings.ThumbnailWidth, 0, imaging.Lanczos)
				}

				buf := new(bytes.Buffer)
				err = jpeg.Encode(buf, thumbnail, &jpeg.Options{Quality: 90})
				if err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.encode_jpeg.error"), thumbnailPath, err)
					return
				}

				if err := utils.WriteFile(buf.Bytes(), thumbnailPathList[i]); err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.upload_thumb.error"), thumbnailPath, err)
					return
				}
			}()

			// Create preview
			go func() {
				previewPath := previewPathList[i]

				var preview image.Image
				if width > int(utils.Cfg.FileSettings.PreviewWidth) {
					preview = imaging.Resize(img, utils.Cfg.FileSettings.PreviewWidth, utils.Cfg.FileSettings.PreviewHeight, imaging.Lanczos)
				} else {
					preview = img
				}

				buf := new(bytes.Buffer)

				err = jpeg.Encode(buf, preview, &jpeg.Options{Quality: 90})
				if err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.encode_preview.error"), previewPath, err)
					return
				}

				if err := utils.WriteFile(buf.Bytes(), previewPath); err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.upload_preview.error"), previewPath, err)
					return
				}
			}()
		}()
	}
}

func getImageOrientation(imageData []byte) (int, error) {
	if exifData, err := exif.Decode(bytes.NewReader(imageData)); err != nil {
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

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if data, err := utils.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFileThumbnail(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if info.ThumbnailPath == "" {
		c.Err = model.NewLocAppError("getFileThumbnail", "api.file.get_file_thumbnail.no_thumbnail.app_error", nil, "file_id="+info.Id)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if data, err := utils.ReadFile(info.ThumbnailPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFilePreview(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if info.PreviewPath == "" {
		c.Err = model.NewLocAppError("getFilePreview", "api.file.get_file_preview.no_preview.app_error", nil, "file_id="+info.Id)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if data, err := utils.ReadFile(info.PreviewPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFileInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")

	w.Write([]byte(info.ToJson()))
}

func getPublicFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.FileSettings.EnablePublicLink {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	info, err := getFileInfoForRequest(c, r, false)
	if err != nil {
		c.Err = err
		return
	}

	hash := r.URL.Query().Get("h")

	if len(hash) > 0 {
		correctHash := generatePublicLinkHash(info.Id, *utils.Cfg.FileSettings.PublicLinkSalt)

		if hash != correctHash {
			c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}
	} else {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if data, err := utils.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFileInfoForRequest(c *Context, r *http.Request, requireFileVisible bool) (*model.FileInfo, *model.AppError) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		err := model.NewLocAppError("getFileInfoForRequest", "api.file.get_file_info_for_request.storage.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return nil, err
	}

	params := mux.Vars(r)

	fileId := params["file_id"]
	if len(fileId) != 26 {
		return nil, NewInvalidParamError("getFileInfoForRequest", "file_id")
	}

	var info *model.FileInfo
	if result := <-Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		return nil, result.Err
	} else {
		info = result.Data.(*model.FileInfo)
	}

	// only let users access files visible in a channel, unless they're the one who uploaded the file
	if info.UserId != c.Session.UserId {
		if len(info.PostId) == 0 {
			err := model.NewLocAppError("getFileInfoForRequest", "api.file.get_file_info_for_request.no_post.app_error", nil, "file_id="+fileId)
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}

		if requireFileVisible {
			if !HasPermissionToPostContext(c, info.PostId, model.PERMISSION_READ_CHANNEL) {
				return nil, c.Err
			}
		}
	}

	return info, nil
}

func getPublicFileOld(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_public_file_old.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	} else if !utils.Cfg.FileSettings.EnablePublicLink {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)

	teamId := params["team_id"]
	channelId := params["channel_id"]
	userId := params["user_id"]
	filename := params["filename"]

	hash := r.URL.Query().Get("h")

	if len(hash) > 0 {
		correctHash := generatePublicLinkHash(filename, *utils.Cfg.FileSettings.PublicLinkSalt)

		if hash != correctHash {
			c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}
	} else {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	path := "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename

	var info *model.FileInfo
	if result := <-Srv.Store.FileInfo().GetByPath(path); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		info = result.Data.(*model.FileInfo)
	}

	if len(info.PostId) == 0 {
		c.Err = model.NewLocAppError("getPublicFileOld", "api.file.get_public_file_old.no_post.app_error", nil, "file_id="+info.Id)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if data, err := utils.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func writeFileResponse(filename string, bytes []byte, w http.ResponseWriter, r *http.Request) *model.AppError {
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

	// attach extra headers to trigger a download on IE, Edge, and Safari
	ua := user_agent.New(r.UserAgent())
	bname, _ := ua.Browser()

	w.Header().Set("Content-Disposition", "attachment;filename=\""+filename+"\"")

	if bname == "Edge" || bname == "Internet Explorer" || bname == "Safari" {
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// prevent file links from being embedded in iframes
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	w.Write(bytes)

	return nil
}

func getPublicLink(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.FileSettings.EnablePublicLink {
		c.Err = model.NewLocAppError("getPublicLink", "api.file.get_public_link.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if len(info.PostId) == 0 {
		c.Err = model.NewLocAppError("getPublicLink", "api.file.get_public_link.no_post.app_error", nil, "file_id="+info.Id)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	w.Write([]byte(model.StringToJson(generatePublicLink(c.GetSiteURL(), info))))
}

func generatePublicLink(siteURL string, info *model.FileInfo) string {
	hash := generatePublicLinkHash(info.Id, *utils.Cfg.FileSettings.PublicLinkSalt)
	return fmt.Sprintf("%s%s/public/files/%v/get?h=%s", siteURL, model.API_URL_SUFFIX, info.Id, hash)
}

func generatePublicLinkHash(fileId, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(salt))
	hash.Write([]byte(fileId))

	return base64.RawURLEncoding.EncodeToString(hash.Sum(nil))
}
