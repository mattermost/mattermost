// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/nfnt/resize"
	_ "golang.org/x/image/bmp"
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
)

func InitFile(r *mux.Router) {
	l4g.Debug("Initializing file api routes")

	sr := r.PathPrefix("/files").Subrouter()
	sr.Handle("/upload", ApiUserRequired(uploadFile)).Methods("POST")
	sr.Handle("/get/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+(\\.[A-Za-z0-9]{3,})?}", ApiAppHandler(getFile)).Methods("GET", "HEAD")
	sr.Handle("/get_public_link", ApiUserRequired(getPublicLink)).Methods("POST")
}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.IsS3Configured() && !utils.Cfg.ServiceSettings.UseLocalStorage {
		c.Err = model.NewAppError("uploadFile", "Unable to upload file. Amazon S3 not configured and local server storage turned off. ", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	err := r.ParseMultipartForm(model.MAX_FILE_SIZE)
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

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

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

	for i, _ := range files {
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

		path := "teams/" + c.Session.TeamId + "/channels/" + channelId + "/users/" + c.Session.UserId + "/" + uid + "/" + filename

		if err := writeFile(buf.Bytes(), path); err != nil {
			c.Err = err
			return
		}

		if model.IsFileExtImage(filepath.Ext(files[i].Filename)) {
			imageNameList = append(imageNameList, uid+"/"+filename)
			imageDataList = append(imageDataList, buf.Bytes())
		}

		encName := utils.UrlEncode(filename)

		fileUrl := "/" + channelId + "/" + c.Session.UserId + "/" + uid + "/" + encName
		resStruct.Filenames = append(resStruct.Filenames, fileUrl)
	}

	for _, clientId := range props["client_ids"] {
		resStruct.ClientIds = append(resStruct.ClientIds, clientId)
	}

	fireAndForgetHandleImages(imageNameList, imageDataList, c.Session.TeamId, channelId, c.Session.UserId)

	w.Write([]byte(resStruct.ToJson()))
}

func fireAndForgetHandleImages(filenames []string, fileData [][]byte, teamId, channelId, userId string) {

	go func() {
		dest := "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/"

		for i, filename := range filenames {
			name := filename[:strings.LastIndex(filename, ".")]
			go func() {
				// Decode image bytes into Image object
				img, _, err := image.Decode(bytes.NewReader(fileData[i]))
				if err != nil {
					l4g.Error("Unable to decode image channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
					return
				}

				// Decode image config
				imgConfig, _, err := image.DecodeConfig(bytes.NewReader(fileData[i]))
				if err != nil {
					l4g.Error("Unable to decode image config channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
					return
				}

				// Remove transparency due to JPEG's lack of support of it
				temp := image.NewRGBA(img.Bounds())
				draw.Draw(temp, temp.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
				draw.Draw(temp, temp.Bounds(), img, img.Bounds().Min, draw.Over)
				img = temp

				// Create thumbnail
				go func() {
					thumbWidth := float64(utils.Cfg.ImageSettings.ThumbnailWidth)
					thumbHeight := float64(utils.Cfg.ImageSettings.ThumbnailHeight)
					imgWidth := float64(imgConfig.Width)
					imgHeight := float64(imgConfig.Height)

					var thumbnail image.Image
					if imgHeight < thumbHeight && imgWidth < thumbWidth {
						thumbnail = img
					} else if imgHeight/imgWidth < thumbHeight/thumbWidth {
						thumbnail = resize.Resize(0, utils.Cfg.ImageSettings.ThumbnailHeight, img, resize.Lanczos3)
					} else {
						thumbnail = resize.Resize(utils.Cfg.ImageSettings.ThumbnailWidth, 0, img, resize.Lanczos3)
					}

					buf := new(bytes.Buffer)
					err = jpeg.Encode(buf, thumbnail, &jpeg.Options{Quality: 90})
					if err != nil {
						l4g.Error("Unable to encode image as jpeg channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}

					if err := writeFile(buf.Bytes(), dest+name+"_thumb.jpg"); err != nil {
						l4g.Error("Unable to upload thumbnail channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}
				}()

				// Create preview
				go func() {
					var preview image.Image
					if imgConfig.Width > int(utils.Cfg.ImageSettings.PreviewWidth) {
						preview = resize.Resize(utils.Cfg.ImageSettings.PreviewWidth, utils.Cfg.ImageSettings.PreviewHeight, img, resize.Lanczos3)
					} else {
						preview = img
					}

					buf := new(bytes.Buffer)

					err = jpeg.Encode(buf, preview, &jpeg.Options{Quality: 90})
					if err != nil {
						l4g.Error("Unable to encode image as preview jpg channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}

					if err := writeFile(buf.Bytes(), dest+name+"_preview.jpg"); err != nil {
						l4g.Error("Unable to upload preview channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}
				}()
			}()
		}
	}()
}

type ImageGetResult struct {
	Error     error
	ImageData []byte
}

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.IsS3Configured() && !utils.Cfg.ServiceSettings.UseLocalStorage {
		c.Err = model.NewAppError("getFile", "Unable to upload file. Amazon S3 not configured and local server storage turned off. ", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getFile", "channel_id")
		return
	}

	userId := params["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("getFile", "user_id")
		return
	}

	filename := params["filename"]
	if len(filename) == 0 {
		c.SetInvalidParam("getFile", "filename")
		return
	}

	hash := r.URL.Query().Get("h")
	data := r.URL.Query().Get("d")
	teamId := r.URL.Query().Get("t")

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

	path := ""
	if len(teamId) == 26 {
		path = "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
	} else {
		path = "teams/" + c.Session.TeamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
	}

	fileData := make(chan []byte)
	asyncGetFile(path, fileData)

	if len(hash) > 0 && len(data) > 0 && len(teamId) == 26 {
		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.PublicLinkSalt)) {
			c.Err = model.NewAppError("getFile", "The public link does not appear to be valid", "")
			return
		}
		props := model.MapFromJson(strings.NewReader(data))

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*24*7 { // one week
			c.Err = model.NewAppError("getFile", "The public link has expired", "")
			return
		}
	} else if !c.HasPermissionsToChannel(cchan, "getFile") {
		return
	}

	f := <-fileData

	if f == nil {
		c.Err = model.NewAppError("getFile", "Could not find file.", "path="+path)
		c.Err.StatusCode = http.StatusNotFound
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(f)))

	if r.Method != "HEAD" {
		w.Write(f)
	}
}

func asyncGetFile(path string, fileData chan []byte) {
	go func() {
		data, getErr := readFile(path)
		if getErr != nil {
			l4g.Error(getErr)
			fileData <- nil
		} else {
			fileData <- data
		}
	}()
}

func getPublicLink(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.TeamSettings.AllowPublicLink {
		c.Err = model.NewAppError("getPublicLink", "Public links have been disabled", "")
		c.Err.StatusCode = http.StatusForbidden
	}

	if !utils.IsS3Configured() && !utils.Cfg.ServiceSettings.UseLocalStorage {
		c.Err = model.NewAppError("getPublicLink", "Unable to upload file. Amazon S3 not configured and local server storage turned off. ", "")
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

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

	newProps := make(map[string]string)
	newProps["filename"] = filename
	newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.PublicLinkSalt))

	url := fmt.Sprintf("%s/api/v1/files/get/%s/%s/%s?d=%s&h=%s&t=%s", c.GetSiteURL(), channelId, userId, filename, url.QueryEscape(data), url.QueryEscape(hash), c.Session.TeamId)

	if !c.HasPermissionsToChannel(cchan, "getPublicLink") {
		return
	}

	rData := make(map[string]string)
	rData["public_link"] = url

	w.Write([]byte(model.MapToJson(rData)))
}

func writeFile(f []byte, path string) *model.AppError {

	if utils.IsS3Configured() && !utils.Cfg.ServiceSettings.UseLocalStorage {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

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
			return model.NewAppError("writeFile", "Encountered an error writing to S3", err.Error())
		}
	} else if utils.Cfg.ServiceSettings.UseLocalStorage && len(utils.Cfg.ServiceSettings.StorageDirectory) > 0 {
		if err := os.MkdirAll(filepath.Dir(utils.Cfg.ServiceSettings.StorageDirectory+path), 0774); err != nil {
			return model.NewAppError("writeFile", "Encountered an error creating the directory for the new file", err.Error())
		}

		if err := ioutil.WriteFile(utils.Cfg.ServiceSettings.StorageDirectory+path, f, 0644); err != nil {
			return model.NewAppError("writeFile", "Encountered an error writing to local server storage", err.Error())
		}
	} else {
		return model.NewAppError("writeFile", "File storage not configured properly. Please configure for either S3 or local server file storage.", "")
	}

	return nil
}

func readFile(path string) ([]byte, *model.AppError) {

	if utils.IsS3Configured() && !utils.Cfg.ServiceSettings.UseLocalStorage {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

		// try to get the file from S3 with some basic retry logic
		tries := 0
		for {
			tries++

			f, err := bucket.Get(path)

			if f != nil {
				return f, nil
			} else if tries >= 3 {
				return nil, model.NewAppError("readFile", "Unable to get file from S3", "path="+path+", err="+err.Error())
			}
			time.Sleep(3000 * time.Millisecond)
		}
	} else if utils.Cfg.ServiceSettings.UseLocalStorage && len(utils.Cfg.ServiceSettings.StorageDirectory) > 0 {
		if f, err := ioutil.ReadFile(utils.Cfg.ServiceSettings.StorageDirectory + path); err != nil {
			return nil, model.NewAppError("readFile", "Encountered an error reading from local server storage", err.Error())
		} else {
			return f, nil
		}
	} else {
		return nil, model.NewAppError("readFile", "File storage not configured properly. Please configure for either S3 or local server file storage.", "")
	}
}
