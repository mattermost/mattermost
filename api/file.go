// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
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

	BaseRoutes.Files.Handle("/upload", ApiUserRequired(uploadFile)).Methods("POST")
	BaseRoutes.Files.Handle("/get/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+(\\.[A-Za-z0-9]{3,})?}", ApiUserRequiredTrustRequester(getFile)).Methods("GET")
	BaseRoutes.Files.Handle("/get_info/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+(\\.[A-Za-z0-9]{3,})?}", ApiUserRequired(getFileInfo)).Methods("GET")
	BaseRoutes.Files.Handle("/get_public_link", ApiUserRequired(getPublicLink)).Methods("POST")

	BaseRoutes.Public.Handle("/files/get/{team_id:[A-Za-z0-9]+}/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+(\\.[A-Za-z0-9]{3,})?}", ApiAppHandlerTrustRequesterIndependent(getPublicFile)).Methods("GET")
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

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.TeamId, channelId, c.Session.UserId)

	files := m.File["files"]

	resStruct := &model.FileUploadResponse{
		Filenames: []string{},
		ClientIds: []string{},
	}

	imageNameList := []string{}
	imageDataList := [][]byte{}

	if !c.HasPermissionsToChannel(cchan, "uploadFile") {
		return
	}

	for i := range files {
		file, err := files[i].Open()
		defer file.Close()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		buf := bytes.NewBuffer(nil)
		io.Copy(buf, file)

		filename := filepath.Base(files[i].Filename)

		uid := model.NewId()

		if model.IsFileExtImage(filepath.Ext(files[i].Filename)) {
			imageNameList = append(imageNameList, uid+"/"+filename)
			imageDataList = append(imageDataList, buf.Bytes())

			// Decode image config first to check dimensions before loading the whole thing into memory later on
			config, _, err := image.DecodeConfig(bytes.NewReader(buf.Bytes()))
			if err != nil {
				c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.image.app_error", nil, err.Error())
				return
			} else if config.Width*config.Height > MaxImageSize {
				c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.large_image.app_error", nil, c.T("api.file.file_upload.exceeds"))
				return
			}
		}

		path := "teams/" + c.TeamId + "/channels/" + channelId + "/users/" + c.Session.UserId + "/" + uid + "/" + filename

		if err := WriteFile(buf.Bytes(), path); err != nil {
			c.Err = err
			return
		}

		encName := utils.UrlEncode(filename)

		fileUrl := "/" + channelId + "/" + c.Session.UserId + "/" + uid + "/" + encName
		resStruct.Filenames = append(resStruct.Filenames, fileUrl)
	}

	for _, clientId := range props["client_ids"] {
		resStruct.ClientIds = append(resStruct.ClientIds, clientId)
	}

	go handleImages(imageNameList, imageDataList, c.TeamId, channelId, c.Session.UserId)

	w.Write([]byte(resStruct.ToJson()))
}

func handleImages(filenames []string, fileData [][]byte, teamId, channelId, userId string) {
	dest := "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/"

	for i, filename := range filenames {
		name := filename[:strings.LastIndex(filename, ".")]
		go func() {
			// Decode image bytes into Image object
			img, imgType, err := image.Decode(bytes.NewReader(fileData[i]))
			if err != nil {
				l4g.Error(utils.T("api.file.handle_images_forget.decode.error"), channelId, userId, filename, err)
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
					l4g.Error(utils.T("api.file.handle_images_forget.encode_jpeg.error"), channelId, userId, filename, err)
					return
				}

				if err := WriteFile(buf.Bytes(), dest+name+"_thumb.jpg"); err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.upload_thumb.error"), channelId, userId, filename, err)
					return
				}
			}()

			// Create preview
			go func() {
				var preview image.Image
				if width > int(utils.Cfg.FileSettings.PreviewWidth) {
					preview = imaging.Resize(img, utils.Cfg.FileSettings.PreviewWidth, utils.Cfg.FileSettings.PreviewHeight, imaging.Lanczos)
				} else {
					preview = img
				}

				buf := new(bytes.Buffer)

				err = jpeg.Encode(buf, preview, &jpeg.Options{Quality: 90})
				if err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.encode_preview.error"), channelId, userId, filename, err)
					return
				}

				if err := WriteFile(buf.Bytes(), dest+name+"_preview.jpg"); err != nil {
					l4g.Error(utils.T("api.file.handle_images_forget.upload_preview.error"), channelId, userId, filename, err)
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

type ImageGetResult struct {
	Error     error
	ImageData []byte
}

func getFileInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getFileInfo", "channel_id")
		return
	}

	userId := params["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("getFileInfo", "user_id")
		return
	}

	filename := params["filename"]
	if len(filename) == 0 {
		c.SetInvalidParam("getFileInfo", "filename")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.TeamId, channelId, c.Session.UserId)

	path := "teams/" + c.TeamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
	var info *model.FileInfo

	if cached, ok := fileInfoCache.Get(path); ok {
		info = cached.(*model.FileInfo)
	} else {
		fileData := make(chan []byte)
		go readFile(path, fileData)

		newInfo, err := model.GetInfoForBytes(filename, <-fileData)
		if err != nil {
			c.Err = err
			return
		} else {
			fileInfoCache.Add(path, newInfo)
			info = newInfo
		}
	}

	if !c.HasPermissionsToChannel(cchan, "getFileInfo") {
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")

	w.Write([]byte(info.ToJson()))
}

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	teamId := c.TeamId
	channelId := params["channel_id"]
	userId := params["user_id"]
	filename := params["filename"]

	if !c.HasPermissionsToChannel(Srv.Store.Channel().CheckPermissionsTo(teamId, channelId, c.Session.UserId), "getFile") {
		return
	}

	if err, bytes := getFileData(teamId, channelId, userId, filename); err != nil {
		c.Err = err
		return
	} else if err := writeFileResponse(filename, bytes, w, r); err != nil {
		c.Err = err
		return
	}
}

func getPublicFile(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	teamId := params["team_id"]
	channelId := params["channel_id"]
	userId := params["user_id"]
	filename := params["filename"]

	hash := r.URL.Query().Get("h")
	data := r.URL.Query().Get("d")

	if !utils.Cfg.FileSettings.EnablePublicLink {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if len(hash) > 0 && len(data) > 0 {
		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.FileSettings.PublicLinkSalt)) {
			c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}
	} else {
		c.Err = model.NewLocAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if err, bytes := getFileData(teamId, channelId, userId, filename); err != nil {
		c.Err = err
		return
	} else if err := writeFileResponse(filename, bytes, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFileData(teamId string, channelId string, userId string, filename string) (*model.AppError, []byte) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		err := model.NewLocAppError("getFileData", "api.file.upload_file.storage.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err, nil
	}

	if len(teamId) != 26 {
		return NewInvalidParamError("getFileData", "team_id"), nil
	}

	if len(channelId) != 26 {
		return NewInvalidParamError("getFileData", "channel_id"), nil
	}

	if len(userId) != 26 {
		return NewInvalidParamError("getFileData", "user_id"), nil
	}

	if len(filename) == 0 {
		return NewInvalidParamError("getFileData", "filename"), nil
	}

	path := "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename

	fileChan := make(chan []byte)
	go readFile(path, fileChan)

	if bytes := <-fileChan; bytes == nil {
		err := model.NewLocAppError("writeFileResponse", "api.file.get_file.not_found.app_error", nil, "path="+path)
		err.StatusCode = http.StatusNotFound
		return err, nil
	} else {
		return nil, bytes
	}
}

func writeFileResponse(filename string, bytes []byte, w http.ResponseWriter, r *http.Request) *model.AppError {
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer

	// attach extra headers to trigger a download on IE, Edge, and Safari
	ua := user_agent.New(r.UserAgent())
	bname, _ := ua.Browser()

	parts := strings.Split(filename, "/")
	filePart := strings.Split(parts[len(parts)-1], "?")[0]
	w.Header().Set("Content-Disposition", "attachment;filename=\""+filePart+"\"")

	if bname == "Edge" || bname == "Internet Explorer" || bname == "Safari" {
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// prevent file links from being embedded in iframes
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	w.Write(bytes)

	return nil
}

func readFile(path string, fileData chan []byte) {
	data, getErr := ReadFile(path)
	if getErr != nil {
		l4g.Error(getErr)
		fileData <- nil
	} else {
		fileData <- data
	}
}

func getPublicLink(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("uploadFile", "api.file.upload_file.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !utils.Cfg.FileSettings.EnablePublicLink {
		c.Err = model.NewLocAppError("getPublicLink", "api.file.get_public_link.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	props := model.MapFromJson(r.Body)

	filename := props["filename"]
	if len(filename) == 0 {
		c.SetInvalidParam("getPublicLink", "filename")
		return
	}

	matches := model.PartialUrlRegex.FindAllStringSubmatch(filename, -1)
	if len(matches) == 0 || len(matches[0]) < 4 {
		c.SetInvalidParam("getPublicLink", "filename")
		return
	}

	channelId := matches[0][1]
	userId := matches[0][2]
	filename = matches[0][3]

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.TeamId, channelId, c.Session.UserId)

	newProps := make(map[string]string)
	newProps["filename"] = filename

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.FileSettings.PublicLinkSalt))

	url := fmt.Sprintf("%s/public/files/get/%s/%s/%s/%s?d=%s&h=%s", c.GetSiteURL()+model.API_URL_SUFFIX, c.TeamId, channelId, userId, filename, url.QueryEscape(data), url.QueryEscape(hash))

	if !c.HasPermissionsToChannel(cchan, "getPublicLink") {
		return
	}

	w.Write([]byte(model.StringToJson(url)))
}

func WriteFile(f []byte, path string) *model.AppError {

	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		ext := filepath.Ext(path)

		var err error
		if model.IsFileExtImage(ext) {
			options := s3.Options{}
			err = bucket.Put(path, f, model.GetImageMimeType(ext), s3.Private, options)

		} else {
			options := s3.Options{}
			err = bucket.Put(path, f, "binary/octet-stream", s3.Private, options)
		}

		if err != nil {
			return model.NewLocAppError("WriteFile", "api.file.write_file.s3.app_error", nil, err.Error())
		}
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := WriteFileLocally(f, utils.Cfg.FileSettings.Directory+path); err != nil {
			return err
		}
	} else {
		return model.NewLocAppError("WriteFile", "api.file.write_file.configured.app_error", nil, "")
	}

	return nil
}

func MoveFile(oldPath, newPath string) *model.AppError {
	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		fileData := make(chan []byte)
		go readFile(oldPath, fileData)
		fileBytes := <-fileData

		if fileBytes == nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.get_from_s3.app_error", nil, "")
		}

		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		if err := bucket.Del(oldPath); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.delete_from_s3.app_error", nil, err.Error())
		}

		if err := WriteFile(fileBytes, newPath); err != nil {
			return err
		}
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {

		if err := os.MkdirAll(filepath.Dir(utils.Cfg.FileSettings.Directory+newPath), 0774); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error())
		}

		if err := os.Rename(utils.Cfg.FileSettings.Directory+oldPath, utils.Cfg.FileSettings.Directory+newPath); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error())
		}
	} else {
		return model.NewLocAppError("moveFile", "api.file.move_file.configured.app_error", nil, "")
	}

	return nil
}

func WriteFileLocally(f []byte, path string) *model.AppError {
	if err := os.MkdirAll(filepath.Dir(path), 0774); err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return model.NewLocAppError("WriteFile", "api.file.write_file_locally.create_dir.app_error", nil, "directory="+directory+", err="+err.Error())
	}

	if err := ioutil.WriteFile(path, f, 0644); err != nil {
		return model.NewLocAppError("WriteFile", "api.file.write_file_locally.writing.app_error", nil, err.Error())
	}

	return nil
}

func ReadFile(path string) ([]byte, *model.AppError) {

	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		// try to get the file from S3 with some basic retry logic
		tries := 0
		for {
			tries++

			f, err := bucket.Get(path)

			if f != nil {
				return f, nil
			} else if tries >= 3 {
				return nil, model.NewLocAppError("ReadFile", "api.file.read_file.get.app_error", nil, "path="+path+", err="+err.Error())
			}
			time.Sleep(3000 * time.Millisecond)
		}
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if f, err := ioutil.ReadFile(utils.Cfg.FileSettings.Directory + path); err != nil {
			return nil, model.NewLocAppError("ReadFile", "api.file.read_file.reading_local.app_error", nil, err.Error())
		} else {
			return f, nil
		}
	} else {
		return nil, model.NewLocAppError("ReadFile", "api.file.read_file.configured.app_error", nil, "")
	}
}

func openFileWriteStream(path string) (io.Writer, *model.AppError) {
	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		return nil, model.NewLocAppError("openFileWriteStream", "api.file.open_file_write_stream.s3.app_error", nil, "")
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.MkdirAll(filepath.Dir(utils.Cfg.FileSettings.Directory+path), 0774); err != nil {
			return nil, model.NewLocAppError("openFileWriteStream", "api.file.open_file_write_stream.creating_dir.app_error", nil, err.Error())
		}

		if fileHandle, err := os.Create(utils.Cfg.FileSettings.Directory + path); err != nil {
			return nil, model.NewLocAppError("openFileWriteStream", "api.file.open_file_write_stream.local_server.app_error", nil, err.Error())
		} else {
			fileHandle.Chmod(0644)
			return fileHandle, nil
		}

	}

	return nil, model.NewLocAppError("openFileWriteStream", "api.file.open_file_write_stream.configured.app_error", nil, "")
}

func closeFileWriteStream(file io.Writer) {
	file.(*os.File).Close()
}

func awsRegion() aws.Region {
	if region, ok := aws.Regions[utils.Cfg.FileSettings.AmazonS3Region]; ok {
		return region
	}

	return aws.Region{
		Name:                 utils.Cfg.FileSettings.AmazonS3Region,
		S3Endpoint:           utils.Cfg.FileSettings.AmazonS3Endpoint,
		S3BucketEndpoint:     utils.Cfg.FileSettings.AmazonS3BucketEndpoint,
		S3LocationConstraint: *utils.Cfg.FileSettings.AmazonS3LocationConstraint,
		S3LowercaseBucket:    *utils.Cfg.FileSettings.AmazonS3LowercaseBucket,
	}
}
