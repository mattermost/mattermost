// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"crypto/subtle"
	"io"
	"io/ioutil"
	"mime"
	"mime/multipart"
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

const maxUploadDrainBytes = (10 * 1024 * 1024)
const maxMultipartValueBytes = 10 * 1024

func (api *API) InitFile() {
	api.BaseRoutes.Files.Handle("", api.ApiSessionRequired(uploadFileStream)).Methods("POST")
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

		if !c.App.SessionHasPermissionToChannel(c.App.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
			c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
			return
		}

		resStruct, appErr = c.App.UploadFiles(
			FILE_TEAM_ID,
			channelId,
			c.App.Session.UserId,
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
		c.Params.ChannelId = channelId
		c.RequireChannelId()
		if c.Err != nil {
			return
		}

		if !c.App.SessionHasPermissionToChannel(c.App.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
			c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
			return
		}

		resStruct, appErr = c.App.UploadMultipartFiles(
			FILE_TEAM_ID,
			channelId,
			c.App.Session.UserId,
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

func parseMultipartRequestHeader(req *http.Request) (boundary string, err error) {
	v := req.Header.Get("Content-Type")
	if v == "" {
		return "", http.ErrNotMultipart
	}
	d, params, err := mime.ParseMediaType(v)
	if err != nil || d != "multipart/form-data" {
		return "", http.ErrNotMultipart
	}
	boundary, ok := params["boundary"]
	if !ok {
		return "", http.ErrMissingBoundary
	}

	return boundary, nil
}

func multipartReader(req *http.Request, readFrom io.Reader) (*multipart.Reader, error) {
	boundary, err := parseMultipartRequestHeader(req)
	if err != nil {
		return nil, err
	}

	if readFrom != nil {
		return multipart.NewReader(readFrom, boundary), nil
	} else {
		return multipart.NewReader(req.Body, boundary), nil
	}
}

func uploadFileStream(c *Context, w http.ResponseWriter, r *http.Request) {
	// Drain any remaining bytes in the request body, up to a limit
	defer io.CopyN(ioutil.Discard, r.Body, maxUploadDrainBytes)

	// Write the response values to the output upon return
	var fileUploadResponse *model.FileUploadResponse
	defer func() {
		if c.Err != nil {
			return
		}

		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(fileUploadResponse.ToJson()))
	}()

	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadFileStream", "api.file.attachments.disabled.app_error",
			nil, "", http.StatusNotImplemented)
		return
	}

	// Parse the post as a regular form (in practice, use the URL values
	// since we never expect a real application/x-www-form-urlencoded
	// form).
	if r.Form == nil {
		err := r.ParseForm()
		if err != nil {
			c.Err = model.NewAppError("uploadFileStream", "api.file.upload_file.read_request.app_error",
				nil, err.Error(), http.StatusBadRequest)
			return
		}
	}

	timestamp := time.Now()

	_, err := parseMultipartRequestHeader(r)
	if err == nil {
		fileUploadResponse = uploadFileMultipart(c, r, nil, timestamp)
		return
	}
	if err != http.ErrNotMultipart {
		c.Err = model.NewAppError("uploadFileStream", "api.file.upload_file.read_request.app_error",
			nil, err.Error(), http.StatusBadRequest)
		return
	}

	// Simple POST with the file in the body and all metadata in the args.
	c.RequireChannelId()
	c.RequireFilename()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_UPLOAD_FILE) {
		c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
		return
	}

	task := c.App.NewUploadFileTask(FILE_TEAM_ID, c.Params.ChannelId, c.App.Session.UserId,
		c.Params.Filename, timestamp, r.ContentLength, r.Body)
	task.ClientId = r.Form.Get("client_id")
	info, appErr := task.Do()
	if appErr != nil {
		c.Err = appErr
		return
	}

	fileUploadResponse = &model.FileUploadResponse{
		FileInfos: []*model.FileInfo{info},
	}
	if task.ClientId != "" {
		fileUploadResponse.ClientIds = []string{task.ClientId}
	}
}

// uploadFileMultipart parses and uploads file(s) from a mime/multipart
// request.  It pre-buffers up to the first part which is either the (a)
// `channel_id` value, or (b) a file. Then in case of (a) it re-processes the
// entire message recursively calling itself in stream mode. In case of (b) it
// calls to uploadFileMultipartBuffered for legacy support
func uploadFileMultipart(c *Context, r *http.Request, asStream io.Reader, timestamp time.Time) *model.FileUploadResponse {

	expectClientIds := true
	var clientIds []string
	resp := model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	var buf *bytes.Buffer
	var mr *multipart.Reader
	var err error
	if asStream == nil {
		// We need to buffer until we get the channel_id, or the first file.
		buf = &bytes.Buffer{}
		mr, err = multipartReader(r, io.TeeReader(r.Body, buf))
	} else {
		mr, err = multipartReader(r, asStream)
	}
	if err != nil {
		c.Err = model.NewAppError("uploadFileMultipart", "api.file.upload_file.read_request.app_error",
			nil, err.Error(), http.StatusBadRequest)
		return nil
	}

	nFiles := 0
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			c.Err = model.NewAppError("uploadFileMultipart", "api.file.upload_file.read_request.app_error",
				nil, err.Error(), http.StatusBadRequest)
			return nil
		}

		// Parse any form fields in the multipart.
		formname := part.FormName()
		if formname == "" {
			continue
		}
		filename := part.FileName()
		if filename == "" {
			var b bytes.Buffer
			_, err := io.CopyN(&b, part, maxMultipartValueBytes)
			if err != nil && err != io.EOF {
				c.Err = model.NewAppError("uploadFileMultipart", "api.file.upload_file.read_request.app_error",
					nil, err.Error(), http.StatusBadRequest)
				return nil
			}
			v := b.String()

			switch formname {
			case "channel_id":
				// Allow the channel_id value in the form to
				// override URL params if any.
				if v != "" {
					c.Params.ChannelId = v
				}

				// Got channel_id, re-process the entire post
				// in the streaming mode.
				if asStream == nil {
					return uploadFileMultipart(c, r, io.MultiReader(buf, r.Body), timestamp)
				}

			case "client_ids":
				if !expectClientIds {
					c.SetInvalidParam("client_ids")
					return nil
				}
				clientIds = append(clientIds, v)

			default:
				c.SetInvalidParam("formname")
				return nil
			}

			continue
		}

		// A file part.

		if c.Params.ChannelId == "" && asStream == nil {
			mr, err = multipartReader(r, io.MultiReader(buf, r.Body))
			if err != nil {
				c.Err = model.NewAppError("uploadFileMultipart", "api.file.upload_file.read_request.app_error",
					nil, err.Error(), http.StatusBadRequest)
				return nil
			}

			return uploadFileMultipartBuffered(c, mr, timestamp)
		}

		c.RequireChannelId()
		if c.Err != nil {
			return nil
		}
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_UPLOAD_FILE) {
			c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
			return nil
		}

		// If there's no clientIds when the first file comes, expect
		// none later.
		if nFiles == 0 && len(clientIds) == 0 {
			expectClientIds = false
		}

		// Must have a exactly one client ID for each file.
		clientId := ""
		if expectClientIds {
			if nFiles >= len(clientIds) {
				c.SetInvalidParam("client_ids")
				return nil
			}

			clientId = clientIds[nFiles]
		}

		task := c.App.NewUploadFileTask(FILE_TEAM_ID, c.Params.ChannelId,
			c.App.Session.UserId, filename, timestamp, -1, part)
		task.ClientId = clientId
		info, appErr := task.Do()
		if appErr != nil {
			c.Err = appErr
			return nil
		}

		// add to the response
		resp.FileInfos = append(resp.FileInfos, info)
		if expectClientIds {
			resp.ClientIds = append(resp.ClientIds, clientId)
		}

		nFiles++
	}

	// Verify that the number of ClientIds matched the number of files.
	if expectClientIds && len(clientIds) != nFiles {
		c.Err = model.NewAppError("uploadFileMultipart", "api.file.upload_file.incorrect_number_of_files.app_error",
			nil, "", http.StatusBadRequest)
		return nil
	}

	return &resp
}

// uploadFileMultipartBuffered reads, buffers, and then uploads the message,
// borrowing from http.ParseMultipartForm.  If successful it returns a
// *model.FileUploadResponse filled in with the individual model.FileInfo's.
func uploadFileMultipartBuffered(c *Context, mr *multipart.Reader,
	timestamp time.Time) *model.FileUploadResponse {

	// Parse the entire form.
	form, err := mr.ReadForm(*c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = model.NewAppError("uploadFileMultipartiBuffered", "api.file.upload_file.read_request.app_error",
			nil, err.Error(), http.StatusInternalServerError)
		return nil
	}

	// get and validate the channel Id, permission to upload there.
	if len(form.Value["channel_id"]) == 0 {
		c.SetInvalidParam("channel_id")
		return nil
	}
	channelId := form.Value["channel_id"][0]
	c.Params.ChannelId = channelId
	c.RequireChannelId()
	if c.Err != nil {
		return nil
	}
	if !c.App.SessionHasPermissionToChannel(c.App.Session, channelId, model.PERMISSION_UPLOAD_FILE) {
		c.SetPermissionError(model.PERMISSION_UPLOAD_FILE)
		return nil
	}

	// Check that we have either no client IDs, or one per file.
	clientIds := form.Value["client_ids"]
	fileHeaders := form.File["files"]
	if len(clientIds) != 0 && len(clientIds) != len(fileHeaders) {
		c.Err = model.NewAppError("uploadFilesMultipartiBuffered", "api.file.upload_file.incorrect_number_of_files.app_error",
			nil, "", http.StatusBadRequest)
		return nil
	}

	resp := model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	for i, fileHeader := range fileHeaders {
		f, err := fileHeader.Open()
		if err != nil {
			c.Err = model.NewAppError("uploadFileMultipartiBuffered", "api.file.upload_file.read_request.app_error",
				map[string]interface{}{"Filename": fileHeader.Filename},
				err.Error(), http.StatusInternalServerError)
			return nil
		}

		clientId := ""
		if len(clientIds) > 0 {
			clientId = clientIds[i]
		}

		task := c.App.NewUploadFileTask(FILE_TEAM_ID, c.Params.ChannelId,
			c.App.Session.UserId, fileHeader.Filename, timestamp, -1, f)
		task.ClientId = clientId
		info, appErr := task.Do()
		f.Close()
		if appErr != nil {
			c.Err = appErr
			return nil
		}

		resp.FileInfos = append(resp.FileInfos, info)
		if clientId != "" {
			resp.ClientIds = append(resp.ClientIds, clientId)
		}
	}

	return &resp
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

	if info.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.App.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
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

	if info.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.App.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
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

	if info.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.App.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
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

	if info.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.App.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
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

	if info.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionToChannelByPost(c.App.Session, info.PostId, model.PERMISSION_READ_CHANNEL) {
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
