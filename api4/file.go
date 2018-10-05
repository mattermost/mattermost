// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"crypto/subtle"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	FILE_TEAM_ID = "noteam"

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

var MEDIA_CONTENT_TYPES = [...]string{
	"image/jpeg",
	"image/png",
	"image/bmp",
	"image/gif",
	"video/avi",
	"video/mpeg",
	"video/mp4",
	"audio/mpeg",
	"audio/wav",
}

func (api *API) InitFile() {
	api.BaseRoutes.Files.Handle("", api.ApiSessionRequired(uploadFile)).Methods("POST")
	api.BaseRoutes.File.Handle("", api.ApiSessionRequiredTrustRequester(getFile)).Methods("GET")
	api.BaseRoutes.File.Handle("/thumbnail", api.ApiSessionRequiredTrustRequester(getFileThumbnail)).Methods("GET")
	api.BaseRoutes.File.Handle("/link", api.ApiSessionRequired(getFileLink)).Methods("GET")
	api.BaseRoutes.File.Handle("/preview", api.ApiSessionRequiredTrustRequester(getFilePreview)).Methods("GET")
	api.BaseRoutes.File.Handle("/info", api.ApiSessionRequired(getFileInfo)).Methods("GET")

	api.BaseRoutes.PublicFile.Handle("", api.ApiHandler(getPublicFile)).Methods("GET")

}

func uploadFile(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadFile", "api.file.attachments.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadFile", "api.file.upload_file.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	now := time.Now()
	var resStruct *model.FileUploadResponse
	var appErr *model.AppError

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil && err != http.ErrNotMultipart {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	} else if err == http.ErrNotMultipart {
		defer r.Body.Close()

		c.RequireChannelId()
		c.RequireFilename()

		if c.Err != nil {
			return
		}

		channelId := c.Params.ChannelId
		filename := c.Params.Filename

		if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
			c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
			return
		}

		resStruct, appErr = c.App.UploadFiles(
			FILE_TEAM_ID,
			channelId,
			c.Session.UserId,
			[]io.ReadCloser{r.Body},
			[]string{filename},
			[]string{},
			now,
		)
	} else {
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

		if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
			c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
			return
		}

		resStruct, appErr = c.App.UploadMultipartFiles(
			FILE_TEAM_ID,
			channelId,
			c.Session.UserId,
			m.File["files"],
			m.Value["client_ids"],
			now,
		)
	}

	if appErr != nil {
		c.Err = appErr
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

	forceDownload, convErr := strconv.ParseBool(r.URL.Query().Get("download"))
	if convErr != nil {
		forceDownload = false
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	fileReader, err := c.App.FileReader(info.Path)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	err = writeFileResponse(info.Name, info.MimeType, info.Size, fileReader, forceDownload, w, r)
	if err != nil {
		c.Err = err
		return
	}
}

func getFileThumbnail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	forceDownload, convErr := strconv.ParseBool(r.URL.Query().Get("download"))
	if convErr != nil {
		forceDownload = false
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if info.ThumbnailPath == "" {
		c.Err = model.NewAppError("getFileThumbnail", "api.file.get_file_thumbnail.no_thumbnail.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	fileReader, err := c.App.FileReader(info.ThumbnailPath)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	err = writeFileResponse(info.Name, THUMBNAIL_IMAGE_TYPE, 0, fileReader, forceDownload, w, r)
	if err != nil {
		c.Err = err
		return
	}
}

func getFileLink(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	if !c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if len(info.PostId) == 0 {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.no_post.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	resp := make(map[string]string)
	resp["link"] = c.App.GeneratePublicLink(c.GetSiteURLHeader(), info)

	w.Write([]byte(model.MapToJson(resp)))
}

func getFilePreview(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	forceDownload, convErr := strconv.ParseBool(r.URL.Query().Get("download"))
	if convErr != nil {
		forceDownload = false
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if info.PreviewPath == "" {
		c.Err = model.NewAppError("getFilePreview", "api.file.get_file_preview.no_preview.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	fileReader, err := c.App.FileReader(info.PreviewPath)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	err = writeFileResponse(info.Name, PREVIEW_IMAGE_TYPE, 0, fileReader, forceDownload, w, r)
	if err != nil {
		c.Err = err
		return
	}
}

func getFileInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	if info.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Write([]byte(info.ToJson()))
}

func getPublicFile(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	if !c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_public_link.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := c.App.GetFileInfo(c.Params.FileId)
	if err != nil {
		c.Err = err
		return
	}

	hash := r.URL.Query().Get("h")

	if len(hash) == 0 {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
		utils.RenderWebAppError(c.App.Config(), w, r, c.Err, c.App.AsymmetricSigningKey())
		return
	}

	if subtle.ConstantTimeCompare([]byte(hash), []byte(app.GeneratePublicLinkHash(info.Id, *c.App.Config().FileSettings.PublicLinkSalt))) != 1 {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_file.public_invalid.app_error", nil, "", http.StatusBadRequest)
		utils.RenderWebAppError(c.App.Config(), w, r, c.Err, c.App.AsymmetricSigningKey())
		return
	}

	fileReader, err := c.App.FileReader(info.Path)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
	}
	defer fileReader.Close()

	err = writeFileResponse(info.Name, info.MimeType, info.Size, fileReader, false, w, r)
	if err != nil {
		c.Err = err
		return
	}
}

func writeFileResponse(filename string, contentType string, contentSize int64, fileReader io.Reader, forceDownload bool, w http.ResponseWriter, r *http.Request) *model.AppError {
	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if contentSize > 0 {
		w.Header().Set("Content-Length", strconv.Itoa(int(contentSize)))
	}

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

	var toDownload bool
	if forceDownload {
		toDownload = true
	} else {
		isMediaType := false

		for _, mediaContentType := range MEDIA_CONTENT_TYPES {
			if strings.HasPrefix(contentType, mediaContentType) {
				isMediaType = true
				break
			}
		}

		toDownload = !isMediaType
	}

	filename = url.PathEscape(filename)

	if toDownload {
		w.Header().Set("Content-Disposition", "attachment;filename=\""+filename+"\"; filename*=UTF-8''"+filename)
	} else {
		w.Header().Set("Content-Disposition", "inline;filename=\""+filename+"\"; filename*=UTF-8''"+filename)
	}

	// prevent file links from being embedded in iframes
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	io.Copy(w, fileReader)

	return nil
}
