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
	"image"
	_ "image/gif"
	"image/jpeg"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func InitFile(r *mux.Router) {
	l4g.Debug("Initializing post api routes")

	sr := r.PathPrefix("/files").Subrouter()
	sr.Handle("/upload", ApiUserRequired(uploadFile)).Methods("POST")
	sr.Handle("/get/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:([A-Za-z0-9]+/)?.+\\.[A-Za-z0-9]{3,}}", ApiAppHandler(getFile)).Methods("GET")
	sr.Handle("/get_public_link", ApiUserRequired(getPublicLink)).Methods("POST")
}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.IsS3Configured() {
		c.Err = model.NewAppError("uploadFile", "Unable to upload file. Amazon S3 not configured. ", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	err := r.ParseMultipartForm(model.MAX_FILE_SIZE)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var auth aws.Auth
	auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
	auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

	s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
	bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

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
		Filenames: []string{}}

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

		ext := filepath.Ext(files[i].Filename)

		uid := model.NewId()

		path := "teams/" + c.Session.TeamId + "/channels/" + channelId + "/users/" + c.Session.UserId + "/" + uid + "/" + files[i].Filename

		if model.IsFileExtImage(ext) {
			options := s3.Options{}
			err = bucket.Put(path, buf.Bytes(), model.GetImageMimeType(ext), s3.Private, options)
			imageNameList = append(imageNameList, uid+"/"+files[i].Filename)
			imageDataList = append(imageDataList, buf.Bytes())
		} else {
			options := s3.Options{}
			err = bucket.Put(path, buf.Bytes(), "binary/octet-stream", s3.Private, options)
		}

		if err != nil {
			c.Err = model.NewAppError("uploadFile", "Unable to upload file. ", err.Error())
			return
		}

		fileUrl := c.TeamUrl + "/api/v1/files/get/" + channelId + "/" + c.Session.UserId + "/" + uid + "/" + files[i].Filename
		resStruct.Filenames = append(resStruct.Filenames, fileUrl)
	}

	fireAndForgetHandleImages(imageNameList, imageDataList, c.Session.TeamId, channelId, c.Session.UserId)

	w.Write([]byte(resStruct.ToJson()))
}

func fireAndForgetHandleImages(filenames []string, fileData [][]byte, teamId, channelId, userId string) {

	go func() {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

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

				// Create thumbnail
				go func() {
					var thumbnail image.Image
					if imgConfig.Width > int(utils.Cfg.ImageSettings.ThumbnailWidth) {
						thumbnail = resize.Resize(utils.Cfg.ImageSettings.ThumbnailWidth, utils.Cfg.ImageSettings.ThumbnailHeight, img, resize.NearestNeighbor)
					} else {
						thumbnail = img
					}

					buf := new(bytes.Buffer)
					err = jpeg.Encode(buf, thumbnail, &jpeg.Options{Quality: 90})
					if err != nil {
						l4g.Error("Unable to encode image as jpeg channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}

					// Upload thumbnail to S3
					options := s3.Options{}
					err = bucket.Put(dest+name+"_thumb.jpg", buf.Bytes(), "image/jpeg", s3.Private, options)
					if err != nil {
						l4g.Error("Unable to upload thumbnail to S3 channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}
				}()

				// Create preview
				go func() {
					var preview image.Image
					if imgConfig.Width > int(utils.Cfg.ImageSettings.PreviewWidth) {
						preview = resize.Resize(utils.Cfg.ImageSettings.PreviewWidth, utils.Cfg.ImageSettings.PreviewHeight, img, resize.NearestNeighbor)
					} else {
						preview = img
					}

					buf := new(bytes.Buffer)
					err = jpeg.Encode(buf, preview, &jpeg.Options{Quality: 90})

					//err = png.Encode(buf, preview)
					if err != nil {
						l4g.Error("Unable to encode image as preview jpg channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
						return
					}

					// Upload preview to S3
					options := s3.Options{}
					err = bucket.Put(dest+name+"_preview.jpg", buf.Bytes(), "image/jpeg", s3.Private, options)
					if err != nil {
						l4g.Error("Unable to upload preview to S3 channelId=%v userId=%v filename=%v err=%v", channelId, userId, filename, err)
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
	if !utils.IsS3Configured() {
		c.Err = model.NewAppError("getFile", "Unable to get file. Amazon S3 not configured. ", "")
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

	var auth aws.Auth
	auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
	auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

	s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
	bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

	path := ""
	if len(teamId) == 26 {
		path = "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
	} else {
		path = "teams/" + c.Session.TeamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
	}

	fileData := make(chan []byte)
	asyncGetFile(bucket, path, fileData)

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
		var f2 []byte
		tries := 0
		for {
			time.Sleep(3000 * time.Millisecond)
			tries++

			asyncGetFile(bucket, path, fileData)
			f2 = <-fileData

			if f2 != nil {
				w.Header().Set("Cache-Control", "max-age=2592000, public")
				w.Header().Set("Content-Length", strconv.Itoa(len(f2)))
				w.Write(f2)
				return
			} else if tries >= 2 {
				break
			}
		}

		c.Err = model.NewAppError("getFile", "Could not find file.", "url extenstion: "+path)
		c.Err.StatusCode = http.StatusNotFound
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(f)))
	w.Write(f)
}

func asyncGetFile(bucket *s3.Bucket, path string, fileData chan []byte) {
	go func() {
		data, getErr := bucket.Get(path)
		if getErr != nil {
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

	if !utils.IsS3Configured() {
		c.Err = model.NewAppError("getPublicLink", "Unable to get link. Amazon S3 not configured. ", "")
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
	if len(matches) == 0 || len(matches[0]) < 5 {
		c.SetInvalidParam("getPublicLink", "filename")
		return
	}

	getType := matches[0][1]
	channelId := matches[0][2]
	userId := matches[0][3]
	filename = matches[0][4]

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)

	newProps := make(map[string]string)
	newProps["filename"] = filename
	newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.PublicLinkSalt))

	url := fmt.Sprintf("%s/api/v1/files/%s/%s/%s/%s?d=%s&h=%s&t=%s", c.TeamUrl, getType, channelId, userId, filename, url.QueryEscape(data), url.QueryEscape(hash), c.Session.TeamId)

	if !c.HasPermissionsToChannel(cchan, "getPublicLink") {
		return
	}

	rData := make(map[string]string)
	rData["public_link"] = url

	w.Write([]byte(model.MapToJson(rData)))
}
