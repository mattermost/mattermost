// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/services/audit"

	mm_model "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

const (
	archiveExtension = ".boardarchive"
)

func (a *API) registerAchivesRoutes(r *mux.Router) {
	// Archive APIs
	r.HandleFunc("/boards/{boardID}/archive/export", a.sessionRequired(a.handleArchiveExportBoard)).Methods("GET")
	r.HandleFunc("/teams/{teamID}/archive/import", a.sessionRequired(a.handleArchiveImport)).Methods("POST")
	r.HandleFunc("/teams/{teamID}/archive/export", a.sessionRequired(a.handleArchiveExportTeam)).Methods("GET")
}

func (a *API) handleArchiveExportBoard(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /boards/{boardID}/archive/export archiveExportBoard
	//
	// Exports an archive of all blocks for one boards.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Id of board to export
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     content:
	//       application-octet-stream:
	//         type: string
	//         format: binary
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	boardID := vars["boardID"]
	userID := getUserID(r)

	// check user has permission to board
	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		// if this user has `manage_system` permission and there is a license with the compliance
		// feature enabled, then we will allow the export.
		license := a.app.GetLicense()
		if !a.permissions.HasPermissionTo(userID, mm_model.PermissionManageSystem) || license == nil || !(*license.Features.Compliance) {
			a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
			return
		}
	}

	auditRec := a.makeAuditRecord(r, "archiveExportBoard", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("BoardID", boardID)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	opts := model.ExportArchiveOptions{
		TeamID:   board.TeamID,
		BoardIDs: []string{board.ID},
	}

	filename := fmt.Sprintf("archive-%s%s", time.Now().Format("2006-01-02"), archiveExtension)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Transfer-Encoding", "binary")

	if err := a.app.ExportArchive(w, opts); err != nil {
		a.errorResponse(w, r, err)
	}

	auditRec.Success()
}

func (a *API) handleArchiveImport(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /teams/{teamID}/archive/import archiveImport
	//
	// Import an archive of boards.
	//
	// ---
	// produces:
	// - application/json
	// consumes:
	// - multipart/form-data
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// - name: file
	//   in: formData
	//   description: archive file to import
	//   required: true
	//   type: file
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session, _ := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	teamID := vars["teamID"]

	if !a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to create board"))
		return
	}

	isGuest, err := a.userIsGuest(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	if isGuest {
		a.errorResponse(w, r, model.NewErrPermission("access denied to create board"))
		return
	}

	file, handle, err := r.FormFile(UploadFormFileKey)
	if err != nil {
		fmt.Fprintf(w, "%v", err)
		return
	}
	defer file.Close()

	auditRec := a.makeAuditRecord(r, "import", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("filename", handle.Filename)
	auditRec.AddMeta("size", handle.Size)

	opt := model.ImportArchiveOptions{
		TeamID:     teamID,
		ModifiedBy: userID,
	}

	if err := a.app.ImportArchive(file, opt); err != nil {
		a.logger.Debug("Error importing archive",
			mlog.String("team_id", teamID),
			mlog.Err(err),
		)
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleArchiveExportTeam(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /teams/{teamID}/archive/export archiveExportTeam
	//
	// Exports an archive of all blocks for all the boards in a team.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Id of team
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     content:
	//       application-octet-stream:
	//         type: string
	//         format: binary
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"
	if a.MattermostAuth {
		a.errorResponse(w, r, model.NewErrNotImplemented("not permitted in plugin mode"))
		return
	}

	vars := mux.Vars(r)
	teamID := vars["teamID"]

	ctx := r.Context()
	session, _ := ctx.Value(sessionContextKey).(*model.Session)
	userID := session.UserID

	auditRec := a.makeAuditRecord(r, "archiveExportTeam", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("TeamID", teamID)

	isGuest, err := a.userIsGuest(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	boards, err := a.app.GetBoardsForUserAndTeam(userID, teamID, !isGuest)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	ids := []string{}
	for _, board := range boards {
		ids = append(ids, board.ID)
	}

	opts := model.ExportArchiveOptions{
		TeamID:   teamID,
		BoardIDs: ids,
	}

	filename := fmt.Sprintf("archive-%s%s", time.Now().Format("2006-01-02"), archiveExtension)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Transfer-Encoding", "binary")

	if err := a.app.ExportArchive(w, opts); err != nil {
		a.errorResponse(w, r, err)
	}

	auditRec.Success()
}
