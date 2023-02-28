// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/boards/app"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/boards/model"

	"github.com/mattermost/mattermost-server/v6/boards/services/audit"
	mm_model "github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/platform/shared/web"
)

// FileUploadResponse is the response to a file upload
// swagger:model
type FileUploadResponse struct {
	// The FileID to retrieve the uploaded file
	// required: true
	FileID string `json:"fileId"`
}

func FileUploadResponseFromJSON(data io.Reader) (*FileUploadResponse, error) {
	var fileUploadResponse FileUploadResponse

	if err := json.NewDecoder(data).Decode(&fileUploadResponse); err != nil {
		return nil, err
	}
	return &fileUploadResponse, nil
}

func FileInfoResponseFromJSON(data io.Reader) (*mm_model.FileInfo, error) {
	var fileInfo mm_model.FileInfo

	if err := json.NewDecoder(data).Decode(&fileInfo); err != nil {
		return nil, err
	}
	return &fileInfo, nil
}

func (a *API) registerFilesRoutes(r *mux.Router) {
	// Files API
	r.HandleFunc("/files/teams/{teamID}/{boardID}/{filename}", a.attachSession(a.handleServeFile, false)).Methods("GET")
	r.HandleFunc("/files/teams/{teamID}/{boardID}/{filename}/info", a.attachSession(a.getFileInfo, false)).Methods("GET")
	r.HandleFunc("/teams/{teamID}/{boardID}/files", a.sessionRequired(a.handleUploadFile)).Methods("POST")
}

func (a *API) handleServeFile(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /files/teams/{teamID}/{boardID}/{filename} getFile
	//
	// Returns the contents of an uploaded file
	//
	// ---
	// produces:
	// - application/json
	// - image/jpg
	// - image/png
	// - image/gif
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: filename
	//   in: path
	//   description: name of the file
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   '404':
	//     description: file not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	filename := vars["filename"]
	userID := getUserID(r)

	hasValidReadToken := a.hasValidReadTokenForBoard(r, boardID)
	if userID == "" && !hasValidReadToken {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied to board"))
		return
	}

	if !hasValidReadToken && !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "getFile", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("teamID", board.TeamID)
	auditRec.AddMeta("filename", filename)

	fileInfo, err := a.app.GetFileInfo(filename)
	if err != nil && !model.IsErrNotFound(err) {
		a.errorResponse(w, r, err)
		return
	}

	if fileInfo != nil && fileInfo.Archived {
		fileMetadata := map[string]interface{}{
			"archived":  true,
			"name":      fileInfo.Name,
			"size":      fileInfo.Size,
			"extension": fileInfo.Extension,
		}

		data, jsonErr := json.Marshal(fileMetadata)
		if jsonErr != nil {
			a.logger.Error("failed to marshal archived file metadata", mlog.String("filename", filename), mlog.Err(jsonErr))
			a.errorResponse(w, r, jsonErr)
			return
		}

		jsonBytesResponse(w, http.StatusBadRequest, data)
		return
	}

	fileReader, err := a.app.GetFileReader(board.TeamID, boardID, filename)
	if err != nil && !errors.Is(err, app.ErrFileNotFound) {
		a.errorResponse(w, r, err)
		return
	}

	if errors.Is(err, app.ErrFileNotFound) && board.ChannelID != "" {
		// prior to moving from workspaces to teams, the filepath was constructed from
		// workspaceID, which is the channel ID in plugin mode.
		// If a file is not found from team ID as we tried above, try looking for it via
		// channel ID.
		fileReader, err = a.app.GetFileReader(board.ChannelID, boardID, filename)
		if err != nil {
			a.errorResponse(w, r, err)
			return
		}
		// move file to team location
		// nothing to do if there is an error
		_ = a.app.MoveFile(board.ChannelID, board.TeamID, boardID, filename)
	}

	defer fileReader.Close()
	web.WriteFileResponse(filename, fileInfo.MimeType, fileInfo.Size, time.Now(), "", fileReader, false, w, r)
	auditRec.Success()
}

func (a *API) getFileInfo(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /files/teams/{teamID}/{boardID}/{filename}/info getFile
	//
	// Returns the metadata of an uploaded file
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: filename
	//   in: path
	//   description: name of the file
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   '404':
	//     description: file not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	teamID := vars["teamID"]
	filename := vars["filename"]
	userID := getUserID(r)

	hasValidReadToken := a.hasValidReadTokenForBoard(r, boardID)
	if userID == "" && !hasValidReadToken {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied to board"))
		return
	}

	if !hasValidReadToken && !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	auditRec := a.makeAuditRecord(r, "getFile", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("teamID", teamID)
	auditRec.AddMeta("filename", filename)

	fileInfo, err := a.app.GetFileInfo(filename)
	if err != nil && !model.IsErrNotFound(err) {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(fileInfo)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /teams/{teamID}/boards/{boardID}/files uploadFile
	//
	// Upload a binary file, attached to a root block
	//
	// ---
	// consumes:
	// - multipart/form-data
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: ID of the team
	//   required: true
	//   type: string
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: uploaded file
	//   in: formData
	//   type: file
	//   description: The file to upload
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/FileUploadResponse"
	//   '404':
	//     description: board not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardCards) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to make board changes"))
		return
	}

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if a.app.GetConfig().MaxFileSize > 0 {
		r.Body = http.MaxBytesReader(w, r.Body, a.app.GetConfig().MaxFileSize)
	}

	file, handle, err := r.FormFile(UploadFormFileKey)
	if err != nil {
		if strings.HasSuffix(err.Error(), "http: request body too large") {
			a.errorResponse(w, r, model.ErrRequestEntityTooLarge)
			return
		}
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}
	defer file.Close()

	auditRec := a.makeAuditRecord(r, "uploadFile", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("teamID", board.TeamID)
	auditRec.AddMeta("filename", handle.Filename)

	fileID, err := a.app.SaveFile(file, board.TeamID, boardID, handle.Filename)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("uploadFile",
		mlog.String("filename", handle.Filename),
		mlog.String("fileID", fileID),
	)
	data, err := json.Marshal(FileUploadResponse{FileID: fileID})
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.AddMeta("fileID", fileID)
	auditRec.Success()
}
