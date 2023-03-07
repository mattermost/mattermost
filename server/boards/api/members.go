// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/services/audit"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func (a *API) registerMembersRoutes(r *mux.Router) {
	// Member APIs
	r.HandleFunc("/boards/{boardID}/members", a.sessionRequired(a.handleGetMembersForBoard)).Methods("GET")
	r.HandleFunc("/boards/{boardID}/members", a.sessionRequired(a.handleAddMember)).Methods("POST")
	r.HandleFunc("/boards/{boardID}/members/{userID}", a.sessionRequired(a.handleUpdateMember)).Methods("PUT")
	r.HandleFunc("/boards/{boardID}/members/{userID}", a.sessionRequired(a.handleDeleteMember)).Methods("DELETE")
	r.HandleFunc("/boards/{boardID}/join", a.sessionRequired(a.handleJoinBoard)).Methods("POST")
	r.HandleFunc("/boards/{boardID}/leave", a.sessionRequired(a.handleLeaveBoard)).Methods("POST")
}

func (a *API) handleGetMembersForBoard(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /boards/{boardID}/members getMembersForBoard
	//
	// Returns the members of the board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/BoardMember"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board members"))
		return
	}

	auditRec := a.makeAuditRecord(r, "getMembersForBoard", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)

	members, err := a.app.GetMembersForBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetMembersForBoard",
		mlog.String("boardID", boardID),
		mlog.Int("membersCount", len(members)),
	)

	data, err := json.Marshal(members)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.Success()
}

func (a *API) handleAddMember(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/members addMember
	//
	// Adds a new member to a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: membership to replace the current one with
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/BoardMember"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       $ref: '#/definitions/BoardMember'
	//   '404':
	//     description: board not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	userID := getUserID(r)

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardRoles) &&
		!(board.Type == model.BoardTypeOpen && a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardProperties)) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to modify board members"))
		return
	}

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var reqBoardMember *model.BoardMember
	if err = json.Unmarshal(requestBody, &reqBoardMember); err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}

	if reqBoardMember.UserID == "" {
		a.errorResponse(w, r, model.NewErrBadRequest("empty userID"))
		return
	}

	if !a.permissions.HasPermissionToTeam(reqBoardMember.UserID, board.TeamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	newBoardMember := &model.BoardMember{
		UserID:          reqBoardMember.UserID,
		BoardID:         boardID,
		SchemeEditor:    reqBoardMember.SchemeEditor,
		SchemeAdmin:     reqBoardMember.SchemeAdmin,
		SchemeViewer:    reqBoardMember.SchemeViewer,
		SchemeCommenter: reqBoardMember.SchemeCommenter,
	}

	auditRec := a.makeAuditRecord(r, "addMember", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("addedUserID", reqBoardMember.UserID)

	member, err := a.app.AddMemberToBoard(newBoardMember)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("AddMember",
		mlog.String("boardID", board.ID),
		mlog.String("addedUserID", reqBoardMember.UserID),
	)

	data, err := json.Marshal(member)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.Success()
}

func (a *API) handleJoinBoard(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/join joinBoard
	//
	// Become a member of a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: allow_admin
	//   in: path
	//   description: allows admin users to join private boards
	//   required: false
	//   type: boolean
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       $ref: '#/definitions/BoardMember'
	//   '404':
	//     description: board not found
	//   '403':
	//     description: access denied
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	allowAdmin := query.Has("allow_admin")

	userID := getUserID(r)
	if userID == "" {
		a.errorResponse(w, r, model.NewErrBadRequest("missing user ID"))
		return
	}

	boardID := mux.Vars(r)["boardID"]
	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	isAdmin := false
	if board.Type != model.BoardTypeOpen {
		if !allowAdmin || !a.permissions.HasPermissionToTeam(userID, board.TeamID, model.PermissionManageTeam) {
			a.errorResponse(w, r, model.NewErrPermission("cannot join a non Open board"))
			return
		}
		isAdmin = true
	}

	if !a.permissions.HasPermissionToTeam(userID, board.TeamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	isGuest, err := a.userIsGuest(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	if isGuest {
		a.errorResponse(w, r, model.NewErrPermission("guests not allowed to join boards"))
		return
	}

	newBoardMember := &model.BoardMember{
		UserID:          userID,
		BoardID:         boardID,
		SchemeAdmin:     board.MinimumRole == model.BoardRoleAdmin || isAdmin,
		SchemeEditor:    board.MinimumRole == model.BoardRoleNone || board.MinimumRole == model.BoardRoleEditor,
		SchemeCommenter: board.MinimumRole == model.BoardRoleCommenter,
		SchemeViewer:    board.MinimumRole == model.BoardRoleViewer,
	}

	auditRec := a.makeAuditRecord(r, "joinBoard", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("addedUserID", userID)

	member, err := a.app.AddMemberToBoard(newBoardMember)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("JoinBoard",
		mlog.String("boardID", board.ID),
		mlog.String("addedUserID", userID),
	)

	data, err := json.Marshal(member)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.Success()
}

func (a *API) handleLeaveBoard(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /boards/{boardID}/leave leaveBoard
	//
	// Remove your own membership from a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   '404':
	//     description: board not found
	//   '403':
	//     description: access denied
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	userID := getUserID(r)
	if userID == "" {
		a.errorResponse(w, r, model.NewErrBadRequest("invalid session"))
		return
	}

	boardID := mux.Vars(r)["boardID"]

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionViewBoard) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to board"))
		return
	}

	board, err := a.app.GetBoard(boardID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "leaveBoard", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("addedUserID", userID)

	err = a.app.DeleteBoardMember(boardID, userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("LeaveBoard",
		mlog.String("boardID", board.ID),
		mlog.String("addedUserID", userID),
	)

	jsonStringResponse(w, http.StatusOK, "{}")

	auditRec.Success()
}

func (a *API) handleUpdateMember(w http.ResponseWriter, r *http.Request) {
	// swagger:operation PUT /boards/{boardID}/members/{userID} updateMember
	//
	// Updates a board member
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: userID
	//   in: path
	//   description: User ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: membership to replace the current one with
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/BoardMember"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       $ref: '#/definitions/BoardMember'
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	paramsUserID := mux.Vars(r)["userID"]
	userID := getUserID(r)

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var reqBoardMember *model.BoardMember
	if err = json.Unmarshal(requestBody, &reqBoardMember); err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}

	newBoardMember := &model.BoardMember{
		UserID:          paramsUserID,
		BoardID:         boardID,
		SchemeAdmin:     reqBoardMember.SchemeAdmin,
		SchemeEditor:    reqBoardMember.SchemeEditor,
		SchemeCommenter: reqBoardMember.SchemeCommenter,
		SchemeViewer:    reqBoardMember.SchemeViewer,
	}

	isGuest, err := a.userIsGuest(paramsUserID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if isGuest {
		newBoardMember.SchemeAdmin = false
	}

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardRoles) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to modify board members"))
		return
	}

	auditRec := a.makeAuditRecord(r, "patchMember", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("patchedUserID", paramsUserID)

	member, err := a.app.UpdateBoardMember(newBoardMember)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("PatchMember",
		mlog.String("boardID", boardID),
		mlog.String("patchedUserID", paramsUserID),
	)

	data, err := json.Marshal(member)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.Success()
}

func (a *API) handleDeleteMember(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /boards/{boardID}/members/{userID} deleteMember
	//
	// Deletes a member from a board
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: boardID
	//   in: path
	//   description: Board ID
	//   required: true
	//   type: string
	// - name: userID
	//   in: path
	//   description: User ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   '404':
	//     description: board not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	boardID := mux.Vars(r)["boardID"]
	paramsUserID := mux.Vars(r)["userID"]
	userID := getUserID(r)

	if _, err := a.app.GetBoard(boardID); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if !a.permissions.HasPermissionToBoard(userID, boardID, model.PermissionManageBoardRoles) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to modify board members"))
		return
	}

	auditRec := a.makeAuditRecord(r, "deleteMember", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("boardID", boardID)
	auditRec.AddMeta("addedUserID", paramsUserID)

	deleteErr := a.app.DeleteBoardMember(boardID, paramsUserID)
	if deleteErr != nil {
		a.errorResponse(w, r, deleteErr)
		return
	}

	a.logger.Debug("DeleteMember",
		mlog.String("boardID", boardID),
		mlog.String("addedUserID", paramsUserID),
	)

	// response
	jsonStringResponse(w, http.StatusOK, "{}")

	auditRec.Success()
}
