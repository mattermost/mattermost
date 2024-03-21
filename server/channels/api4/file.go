// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/web"
)

const (
	FileTeamId = "noteam"

	PreviewImageType   = "image/jpeg"
	ThumbnailImageType = "image/jpeg"
)

const maxMultipartFormDataBytes = 10 * 1024 // 10Kb

func (api *API) InitFile() {
	api.BaseRoutes.Files.Handle("", api.APISessionRequired(uploadFileStream, handlerParamFileAPI)).Methods("POST")
	api.BaseRoutes.File.Handle("", api.APISessionRequiredTrustRequester(getFile)).Methods("GET")
	api.BaseRoutes.File.Handle("/thumbnail", api.APISessionRequiredTrustRequester(getFileThumbnail)).Methods("GET")
	api.BaseRoutes.File.Handle("/link", api.APISessionRequired(getFileLink)).Methods("GET")
	api.BaseRoutes.File.Handle("/preview", api.APISessionRequiredTrustRequester(getFilePreview)).Methods("GET")
	api.BaseRoutes.File.Handle("/info", api.APISessionRequired(getFileInfo)).Methods("GET")

	api.BaseRoutes.Team.Handle("/files/search", api.APISessionRequiredDisableWhenBusy(searchFiles)).Methods("POST")

	api.BaseRoutes.PublicFile.Handle("", api.APIHandler(getPublicFile)).Methods("GET", "HEAD")
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

func multipartReader(req *http.Request, stream io.Reader) (*multipart.Reader, error) {
	boundary, err := parseMultipartRequestHeader(req)
	if err != nil {
		return nil, err
	}

	if stream != nil {
		return multipart.NewReader(stream, boundary), nil
	}

	return multipart.NewReader(req.Body, boundary), nil
}

func uploadFileStream(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadFileStream",
			"api.file.attachments.disabled.app_error",
			nil, "", http.StatusForbidden)
		return
	}

	// Parse the post as a regular form (in practice, use the URL values
	// since we never expect a real application/x-www-form-urlencoded
	// form).
	if r.Form == nil {
		err := r.ParseForm()
		if err != nil {
			c.Err = model.NewAppError("uploadFileStream",
				"api.file.upload_file.read_request.app_error",
				nil, err.Error(), http.StatusBadRequest)
			return
		}
	}

	if r.ContentLength == 0 {
		c.Err = model.NewAppError("uploadFileStream",
			"api.file.upload_file.read_request.app_error",
			nil, "Content-Length should not be 0", http.StatusBadRequest)
		return
	}

	timestamp := time.Now()
	var fileUploadResponse *model.FileUploadResponse

	_, err := parseMultipartRequestHeader(r)
	switch err {
	case nil:
		fileUploadResponse = uploadFileMultipart(c, r, nil, timestamp)

	case http.ErrNotMultipart:
		fileUploadResponse = uploadFileSimple(c, r, timestamp)

	default:
		c.Err = model.NewAppError("uploadFileStream",
			"api.file.upload_file.read_request.app_error",
			nil, err.Error(), http.StatusBadRequest)
	}
	if c.Err != nil {
		return
	}

	// Write the response values to the output upon return
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(fileUploadResponse); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// uploadFileSimple uploads a file from a simple POST with the file in the request body
func uploadFileSimple(c *Context, r *http.Request, timestamp time.Time) *model.FileUploadResponse {
	// Simple POST with the file in the body and all metadata in the args.
	c.RequireChannelId()
	c.RequireFilename()
	if c.Err != nil {
		return nil
	}

	auditRec := c.MakeAuditRecord("uploadFileSimple", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionUploadFile) {
		c.SetPermissionError(model.PermissionUploadFile)
		return nil
	}

	clientId := r.Form.Get("client_id")
	audit.AddEventParameter(auditRec, "client_id", clientId)

	creatorId := c.AppContext.Session().UserId
	if isBookmark, err := strconv.ParseBool(r.URL.Query().Get(model.BookmarkFileOwner)); err == nil && isBookmark {
		creatorId = model.BookmarkFileOwner
		audit.AddEventParameter(auditRec, model.BookmarkFileOwner, true)
	}

	info, appErr := c.App.UploadFileX(c.AppContext, c.Params.ChannelId, c.Params.Filename, r.Body,
		app.UploadFileSetTeamId(FileTeamId),
		app.UploadFileSetUserId(creatorId),
		app.UploadFileSetTimestamp(timestamp),
		app.UploadFileSetContentLength(r.ContentLength),
		app.UploadFileSetClientId(clientId))
	if appErr != nil {
		c.Err = appErr
		return nil
	}
	audit.AddEventParameterAuditable(auditRec, "file", info)

	fileUploadResponse := &model.FileUploadResponse{
		FileInfos: []*model.FileInfo{info},
	}
	if clientId != "" {
		fileUploadResponse.ClientIds = []string{clientId}
	}
	auditRec.Success()
	return fileUploadResponse
}

// uploadFileMultipart parses and uploads file(s) from a mime/multipart
// request.  It pre-buffers up to the first part which is either the (a)
// `channel_id` value, or (b) a file. Then in case of (a) it re-processes the
// entire message recursively calling itself in stream mode. In case of (b) it
// calls to uploadFileMultipartLegacy for legacy support
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
		c.Err = model.NewAppError("uploadFileMultipart",
			"api.file.upload_file.read_request.app_error",
			nil, err.Error(), http.StatusBadRequest)
		return nil
	}

	nFiles := 0
NextPart:
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			c.Err = model.NewAppError("uploadFileMultipart",
				"api.file.upload_file.read_request.app_error",
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
			_, err = io.CopyN(&b, part, maxMultipartFormDataBytes)
			if err != nil && err != io.EOF {
				c.Err = model.NewAppError("uploadFileMultipart",
					"api.file.upload_file.read_form_value.app_error",
					map[string]any{"Formname": formname},
					err.Error(), http.StatusBadRequest)
				return nil
			}
			v := b.String()

			switch formname {
			case "channel_id":
				if c.Params.ChannelId != "" && c.Params.ChannelId != v {
					c.Err = model.NewAppError("uploadFileMultipart",
						"api.file.upload_file.multiple_channel_ids.app_error",
						nil, "", http.StatusBadRequest)
					return nil
				}
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
				c.SetInvalidParam(formname)
				return nil
			}

			continue NextPart
		}

		isBookmark := false
		if val, queryErr := strconv.ParseBool(r.URL.Query().Get(model.BookmarkFileOwner)); queryErr == nil {
			isBookmark = val
		}

		// A file part.

		if c.Params.ChannelId == "" && asStream == nil {
			// Got file before channel_id, fall back to legacy buffered mode
			mr, err = multipartReader(r, io.MultiReader(buf, r.Body))
			if err != nil {
				c.Err = model.NewAppError("uploadFileMultipart",
					"api.file.upload_file.read_request.app_error",
					nil, err.Error(), http.StatusBadRequest)
				return nil
			}

			return uploadFileMultipartLegacy(c, mr, timestamp, isBookmark)
		}

		c.RequireChannelId()
		if c.Err != nil {
			return nil
		}
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionUploadFile) {
			c.SetPermissionError(model.PermissionUploadFile)
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

		auditRec := c.MakeAuditRecord("uploadFileMultipart", audit.Fail)
		audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
		audit.AddEventParameter(auditRec, "client_id", clientId)

		creatorId := c.AppContext.Session().UserId
		if isBookmark {
			creatorId = model.BookmarkFileOwner
			audit.AddEventParameter(auditRec, model.BookmarkFileOwner, true)
		}

		info, appErr := c.App.UploadFileX(c.AppContext, c.Params.ChannelId, filename, part,
			app.UploadFileSetTeamId(FileTeamId),
			app.UploadFileSetUserId(creatorId),
			app.UploadFileSetTimestamp(timestamp),
			app.UploadFileSetContentLength(-1),
			app.UploadFileSetClientId(clientId))
		if appErr != nil {
			c.Err = appErr
			c.LogAuditRec(auditRec)
			return nil
		}
		audit.AddEventParameterAuditable(auditRec, "file", info)

		auditRec.Success()
		c.LogAuditRec(auditRec)

		// add to the response
		resp.FileInfos = append(resp.FileInfos, info)
		if expectClientIds {
			resp.ClientIds = append(resp.ClientIds, clientId)
		}

		nFiles++
	}

	// Verify that the number of ClientIds matched the number of files.
	if expectClientIds && len(clientIds) != nFiles {
		c.Err = model.NewAppError("uploadFileMultipart",
			"api.file.upload_file.incorrect_number_of_client_ids.app_error",
			map[string]any{"NumClientIds": len(clientIds), "NumFiles": nFiles},
			"", http.StatusBadRequest)
		return nil
	}

	return &resp
}

// uploadFileMultipartLegacy reads, buffers, and then uploads the message,
// borrowing from http.ParseMultipartForm.  If successful it returns a
// *model.FileUploadResponse filled in with the individual model.FileInfo's.
func uploadFileMultipartLegacy(c *Context, mr *multipart.Reader,
	timestamp time.Time, isBookmark bool) *model.FileUploadResponse {
	// Parse the entire form.
	form, err := mr.ReadForm(*c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = model.NewAppError("uploadFileMultipartLegacy",
			"api.file.upload_file.read_request.app_error",
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
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionUploadFile) {
		c.SetPermissionError(model.PermissionUploadFile)
		return nil
	}

	// Check that we have either no client IDs, or one per file.
	clientIds := form.Value["client_ids"]
	fileHeaders := form.File["files"]
	if len(clientIds) != 0 && len(clientIds) != len(fileHeaders) {
		c.Err = model.NewAppError("uploadFilesMultipartBuffered",
			"api.file.upload_file.incorrect_number_of_client_ids.app_error",
			map[string]any{"NumClientIds": len(clientIds), "NumFiles": len(fileHeaders)},
			"", http.StatusBadRequest)
		return nil
	}

	resp := model.FileUploadResponse{
		FileInfos: []*model.FileInfo{},
		ClientIds: []string{},
	}

	for i, fileHeader := range fileHeaders {
		f, err := fileHeader.Open()
		if err != nil {
			c.Err = model.NewAppError("uploadFileMultipartLegacy",
				"api.file.upload_file.read_request.app_error",
				nil, err.Error(), http.StatusBadRequest)
			return nil
		}

		clientId := ""
		if len(clientIds) > 0 {
			clientId = clientIds[i]
		}

		auditRec := c.MakeAuditRecord("uploadFileMultipartLegacy", audit.Fail)
		defer c.LogAuditRec(auditRec)
		audit.AddEventParameter(auditRec, "channel_id", channelId)
		audit.AddEventParameter(auditRec, "client_id", clientId)

		creatorId := c.AppContext.Session().UserId
		if isBookmark {
			creatorId = model.BookmarkFileOwner
			audit.AddEventParameter(auditRec, model.BookmarkFileOwner, true)
		}

		info, appErr := c.App.UploadFileX(c.AppContext, c.Params.ChannelId, fileHeader.Filename, f,
			app.UploadFileSetTeamId(FileTeamId),
			app.UploadFileSetUserId(creatorId),
			app.UploadFileSetTimestamp(timestamp),
			app.UploadFileSetContentLength(-1),
			app.UploadFileSetClientId(clientId))
		f.Close()
		if appErr != nil {
			c.Err = appErr
			c.LogAuditRec(auditRec)
			return nil
		}
		audit.AddEventParameterAuditable(auditRec, "file", info)

		auditRec.Success()
		c.LogAuditRec(auditRec)

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

	forceDownload, _ := strconv.ParseBool(r.URL.Query().Get("download"))

	auditRec := c.MakeAuditRecord("getFile", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "force_download", forceDownload)

	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "file", info)

	perm := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), info.ChannelId, model.PermissionReadChannelContent)
	if info.CreatorId == model.BookmarkFileOwner {
		if !perm {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else if info.CreatorId != c.AppContext.Session().UserId && !perm {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	fileReader, err := c.App.FileReader(info.Path)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	auditRec.Success()

	web.WriteFileResponse(info.Name, info.MimeType, info.Size, time.Unix(0, info.UpdateAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, forceDownload, w, r)
}

func getFileThumbnail(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	forceDownload, _ := strconv.ParseBool(r.URL.Query().Get("download"))
	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}

	perm := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), info.ChannelId, model.PermissionReadChannelContent)
	if info.CreatorId == model.BookmarkFileOwner {
		if !perm {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else if info.CreatorId != c.AppContext.Session().UserId && !perm {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	web.WriteFileResponse(info.Name, ThumbnailImageType, 0, time.Unix(0, info.UpdateAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, forceDownload, w, r)
}

func getFileLink(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord("getFileLink", audit.Fail)
	defer c.LogAuditRec(auditRec)

	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "file", info)

	perm := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), info.ChannelId, model.PermissionReadChannelContent)
	if info.CreatorId == model.BookmarkFileOwner {
		if !perm {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else if info.CreatorId != c.AppContext.Session().UserId && !perm {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	if info.PostId == "" && info.CreatorId != model.BookmarkFileOwner {
		c.Err = model.NewAppError("getPublicLink", "api.file.get_public_link.no_post.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
		return
	}

	resp := make(map[string]string)
	link := c.App.GeneratePublicLink(c.GetSiteURLHeader(), info)
	resp["link"] = link

	auditRec.Success()

	w.Write([]byte(model.MapToJSON(resp)))
}

func getFilePreview(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	forceDownload, _ := strconv.ParseBool(r.URL.Query().Get("download"))
	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}

	perm := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), info.ChannelId, model.PermissionReadChannelContent)
	if info.CreatorId == model.BookmarkFileOwner {
		if !perm {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else if info.CreatorId != c.AppContext.Session().UserId && !perm {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	web.WriteFileResponse(info.Name, PreviewImageType, 0, time.Unix(0, info.UpdateAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, forceDownload, w, r)
}

func getFileInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}

	perm := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), info.ChannelId, model.PermissionReadChannelContent)
	if info.CreatorId == model.BookmarkFileOwner {
		if !perm {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else if info.CreatorId != c.AppContext.Session().UserId && !perm {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, private")
	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPublicFile(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireFileId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().FileSettings.EnablePublicLink {
		c.Err = model.NewAppError("getPublicFile", "api.file.get_public_link.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	info, err := c.App.GetFileInfo(c.AppContext, c.Params.FileId)
	if err != nil {
		c.Err = err
		setInaccessibleFileHeader(w, err)
		return
	}

	hash := r.URL.Query().Get("h")

	if hash == "" {
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
		return
	}
	defer fileReader.Close()

	web.WriteFileResponse(info.Name, info.MimeType, info.Size, time.Unix(0, info.UpdateAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, false, w, r)
}

func searchFiles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	var params model.SearchParameter
	jsonErr := json.NewDecoder(r.Body).Decode(&params)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchFiles", "api.post.search_files.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if params.Terms == nil || *params.Terms == "" {
		c.SetInvalidParam("terms")
		return
	}
	terms := *params.Terms

	timeZoneOffset := 0
	if params.TimeZoneOffset != nil {
		timeZoneOffset = *params.TimeZoneOffset
	}

	isOrSearch := false
	if params.IsOrSearch != nil {
		isOrSearch = *params.IsOrSearch
	}

	page := 0
	if params.Page != nil {
		page = *params.Page
	}

	perPage := 60
	if params.PerPage != nil {
		perPage = *params.PerPage
	}

	includeDeletedChannels := false
	if params.IncludeDeletedChannels != nil {
		includeDeletedChannels = *params.IncludeDeletedChannels
	}

	startTime := time.Now()

	results, err := c.App.SearchFilesInTeamForUser(c.AppContext, terms, c.AppContext.Session().UserId, c.Params.TeamId, isOrSearch, includeDeletedChannels, timeZoneOffset, page, perPage)

	elapsedTime := float64(time.Since(startTime)) / float64(time.Second)
	metrics := c.App.Metrics()
	if metrics != nil {
		metrics.IncrementFilesSearchCounter()
		metrics.ObserveFilesSearchDuration(elapsedTime)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(results); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setInaccessibleFileHeader(w http.ResponseWriter, appErr *model.AppError) {
	// File is inaccessible due to cloud plan's limit.
	if appErr.Id == "app.file.cloud.get.app_error" {
		w.Header().Set(model.HeaderFirstInaccessibleFileTime, "1")
	}
}
