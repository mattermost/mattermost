// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	_ "image/gif"
	"io"
	"net/http"
	"net/url"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	_ "golang.org/x/image/bmp"
)

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

	if err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize); err != nil {
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

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
		c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
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
		data := buf.Bytes()

		info, err := app.DoUploadFile(c.TeamId, channelId, c.Session.UserId, fileHeader.Filename, data)
		if err != nil {
			c.Err = err
			return
		}

		if info.PreviewPath != "" || info.ThumbnailPath != "" {
			previewPathList = append(previewPathList, info.PreviewPath)
			thumbnailPathList = append(thumbnailPathList, info.ThumbnailPath)
			imageDataList = append(imageDataList, data)
		}

		resStruct.FileInfos = append(resStruct.FileInfos, info)

		if len(m.Value["client_ids"]) > 0 {
			resStruct.ClientIds = append(resStruct.ClientIds, m.Value["client_ids"][i])
		}
	}

	app.HandleImages(previewPathList, thumbnailPathList, imageDataList)

	w.Write([]byte(resStruct.ToJson()))
}

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if data, err := app.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, info.MimeType, data, w, r); err != nil {
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

	if data, err := app.ReadFile(info.ThumbnailPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, "", data, w, r); err != nil {
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

	if data, err := app.ReadFile(info.PreviewPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, "", data, w, r); err != nil {
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
		correctHash := app.GeneratePublicLinkHash(info.Id, *utils.Cfg.FileSettings.PublicLinkSalt)

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

	if data, err := app.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, info.MimeType, data, w, r); err != nil {
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
	if result := <-app.Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		return nil, result.Err
	} else {
		info = result.Data.(*model.FileInfo)
	}

	// only let users access files visible in a channel, unless they're the one who uploaded the file
	if info.CreatorId != c.Session.UserId {
		if len(info.PostId) == 0 {
			err := model.NewLocAppError("getFileInfoForRequest", "api.file.get_file_info_for_request.no_post.app_error", nil, "file_id="+fileId)
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}

		if requireFileVisible {
			if !app.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
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
		correctHash := app.GeneratePublicLinkHash(filename, *utils.Cfg.FileSettings.PublicLinkSalt)

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
	if result := <-app.Srv.Store.FileInfo().GetByPath(path); result.Err != nil {
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

	if data, err := app.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, info.MimeType, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func writeFileResponse(filename string, contentType string, bytes []byte, w http.ResponseWriter, r *http.Request) *model.AppError {
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))

	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	} else {
		w.Header().Del("Content-Type") // Content-Type will be set automatically by the http writer
	}

	w.Header().Set("Content-Disposition", "attachment;filename=\""+filename+"\"; filename*=UTF-8''"+url.QueryEscape(filename))

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

	w.Write([]byte(model.StringToJson(app.GeneratePublicLink(c.GetSiteURL(), info))))
}
