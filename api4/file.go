// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"net/url"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	FILE_TEAM_ID = "noteam"
)

func InitFile() {
	l4g.Debug(utils.T("api.file.init.debug"))

	BaseRoutes.Files.Handle("", ApiSessionRequired(uploadFile)).Methods("POST")
	BaseRoutes.File.Handle("", ApiSessionRequired(getFile)).Methods("GET")

}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
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
		c.SetInvalidParam("channel_id")
		return
	}
	channelId := props["channel_id"][0]
	if len(channelId) == 0 {
		c.SetInvalidParam("channel_id")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
		c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
		return
	}

	resStruct, err := app.UploadFiles(FILE_TEAM_ID, channelId, c.Session.UserId, m.File["files"], m.Value["client_ids"])
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(resStruct.ToJson()))
}

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	info, err := app.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !app.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
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
