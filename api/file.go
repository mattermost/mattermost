// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	PREVIEW_IMAGE_TYPE   = "image/jpeg"
	THUMBNAIL_IMAGE_TYPE = "image/jpeg"
)

var UNSAFE_CONTENT_TYPES = [...]string{
	"application/javascript",
	"application/ecmascript",
	"text/javascript",
	"text/ecmascript",
	"application/x-javascript",
	"text/html",
}

func (api *API) InitFile() {
	api.BaseRoutes.TeamFiles.Handle("/upload", api.ApiUserRequired(uploadFile)).Methods("POST")

	api.BaseRoutes.NeedFile.Handle("/get", api.ApiUserRequiredTrustRequester(getFile)).Methods("GET")
	api.BaseRoutes.NeedFile.Handle("/get_thumbnail", api.ApiUserRequiredTrustRequester(getFileThumbnail)).Methods("GET")
	api.BaseRoutes.NeedFile.Handle("/get_preview", api.ApiUserRequiredTrustRequester(getFilePreview)).Methods("GET")
	api.BaseRoutes.NeedFile.Handle("/get_info", api.ApiUserRequired(getFileInfo)).Methods("GET")
	api.BaseRoutes.NeedFile.Handle("/get_public_link", api.ApiUserRequired(getPublicLink)).Methods("GET")

	api.BaseRoutes.Public.Handle("/files/{file_id:[A-Za-z0-9]+}/get", api.ApiAppHandlerTrustRequesterIndependent(getPublicFile)).Methods("GET")
	api.BaseRoutes.Public.Handle("/files/get/{team_id:[A-Za-z0-9]+}/{channel_id:[A-Za-z0-9]+}/{user_id:[A-Za-z0-9]+}/{filename:(?:[A-Za-z0-9]+/)?.+(?:\\.[A-Za-z0-9]{3,})?}", api.ApiAppHandlerTrustRequesterIndependent(getPublicFileOld)).Methods("GET")
}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadFile", "api.file.attachments.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadFile", "api.file.upload_file.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
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

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
		c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
		return
	}

	resStruct, err := c.App.UploadFiles(c.TeamId, channelId, c.Session.UserId, m.File["files"], m.Value["client_ids"])
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(resStruct.ToJson()))
}

func getFile(c *Context, w http.ResponseWriter, r *http.Request) {
	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if data, err := c.App.ReadFile(info.Path); err != nil {
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
		c.Err = model.NewAppError("getFileThumbnail", "api.file.get_file_thumbnail.no_thumbnail.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	if data, err := c.App.ReadFile(info.ThumbnailPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, THUMBNAIL_IMAGE_TYPE, data, w, r); err != nil {
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
		c.Err = model.NewAppError("getFilePreview", "api.file.get_file_preview.no_preview.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	if data, err := c.App.ReadFile(info.PreviewPath); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, PREVIEW_IMAGE_TYPE, data, w, r); err != nil {
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
	if !c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := getFileInfoForRequest(c, r, false)
	if err != nil {
		c.Err = err
		return
	}

	hash := r.URL.Query().Get("h")

	if len(hash) > 0 {
		correctHash := app.GeneratePublicLinkHash(info.Id, *c.App.Config().FileSettings.PublicLinkSalt)

		if hash != correctHash {
			c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
			http.Redirect(w, r, c.GetSiteURLHeader()+"/error?message="+utils.T(c.Err.Message), http.StatusTemporaryRedirect)
			return
		}
	} else {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
		http.Redirect(w, r, c.GetSiteURLHeader()+"/error?message="+utils.T(c.Err.Message), http.StatusTemporaryRedirect)
		return
	}

	if data, err := c.App.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, info.MimeType, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func getFileInfoForRequest(c *Context, r *http.Request, requireFileVisible bool) (*model.FileInfo, *model.AppError) {
	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("getFileInfoForRequest", "api.file.get_info_for_request.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	params := mux.Vars(r)

	fileId := params["file_id"]
	if len(fileId) != 26 {
		return nil, NewInvalidParamError("getFileInfoForRequest", "file_id")
	}

	info, err := c.App.GetFileInfo(fileId)
	if err != nil {
		return nil, err
	}

	// only let users access files visible in a channel, unless they're the one who uploaded the file
	if info.CreatorId != c.Session.UserId {
		if len(info.PostId) == 0 {
			err := model.NewAppError("getFileInfoForRequest", "api.file.get_file_info_for_request.no_post.app_error", nil, "file_id="+fileId, http.StatusBadRequest)
			return nil, err
		}

		if requireFileVisible {
			if !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
				return nil, c.Err
			}
		}
	}

	return info, nil
}

func getPublicFileOld(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_public_file_old.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	} else if !c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	params := mux.Vars(r)

	teamId := params["team_id"]
	channelId := params["channel_id"]
	userId := params["user_id"]
	filename := params["filename"]

	hash := r.URL.Query().Get("h")

	if len(hash) > 0 {
		correctHash := app.GeneratePublicLinkHash(filename, *c.App.Config().FileSettings.PublicLinkSalt)

		if hash != correctHash {
			c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
			http.Redirect(w, r, c.GetSiteURLHeader()+"/error?message="+utils.T(c.Err.Message), http.StatusTemporaryRedirect)
			return
		}
	} else {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
		http.Redirect(w, r, c.GetSiteURLHeader()+"/error?message="+utils.T(c.Err.Message), http.StatusTemporaryRedirect)
		return
	}

	path := "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename

	var info *model.FileInfo
	if result := <-c.App.Srv.Store.FileInfo().GetByPath(path); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		info = result.Data.(*model.FileInfo)
	}

	if len(info.PostId) == 0 {
		c.Err = model.NewAppError("getPublicFileOld", "api.file.get_public_file_old.no_post.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	if data, err := c.App.ReadFile(info.Path); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	} else if err := writeFileResponse(info.Name, info.MimeType, data, w, r); err != nil {
		c.Err = err
		return
	}
}

func writeFileResponse(filename string, contentType string, bytes []byte, w http.ResponseWriter, r *http.Request) *model.AppError {
	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set("Content-Length", strconv.Itoa(len(bytes)))
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if contentType == "" {
		contentType = "application/octet-stream"
	} else {
		for _, unsafeContentType := range UNSAFE_CONTENT_TYPES {
			if strings.HasPrefix(contentType, unsafeContentType) {
				contentType = "text/plain"
				break
			}
		}
	}

	w.Header().Set("Content-Type", contentType)

	w.Header().Set("Content-Disposition", "attachment;filename=\""+filename+"\"; filename*=UTF-8''"+url.QueryEscape(filename))

	// prevent file links from being embedded in iframes
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	w.Write(bytes)

	return nil
}

func getPublicLink(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := getFileInfoForRequest(c, r, true)
	if err != nil {
		c.Err = err
		return
	}

	if len(info.PostId) == 0 {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.no_post.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	w.Write([]byte(model.StringToJson(c.App.GeneratePublicLinkV3(c.GetSiteURLHeader(), info))))
}
