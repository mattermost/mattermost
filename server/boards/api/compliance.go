// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/boards/model"

	mm_model "github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	complianceDefaultPage    = "0"
	complianceDefaultPerPage = "60"
)

func (a *API) registerComplianceRoutes(r *mux.Router) {
	// Compliance APIs
	r.HandleFunc("/admin/boards", a.sessionRequired(a.handleGetBoardsForCompliance)).Methods("GET")
	r.HandleFunc("/admin/boards_history", a.sessionRequired(a.handleGetBoardsComplianceHistory)).Methods("GET")
	r.HandleFunc("/admin/blocks_history", a.sessionRequired(a.handleGetBlocksComplianceHistory)).Methods("GET")
}

func (a *API) handleGetBoardsForCompliance(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /admin/boards getBoardsForCompliance
	//
	// Returns boards for a specific team, or all teams.
	//
	// Requires a license that includes Compliance feature. Caller must have `manage_system` permissions.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: team_id
	//   in: query
	//   description: Team ID. If empty then boards across all teams are included.
	//   required: false
	//   type: string
	// - name: page
	//   in: query
	//   description: The page to select (default=0)
	//   required: false
	//   type: integer
	// - name: per_page
	//   in: query
	//   description: Number of boards to return per page(default=60)
	//   required: false
	//   type: integer
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: object
	//       items:
	//         "$ref": "#/definitions/BoardsComplianceResponse"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	teamID := query.Get("team_id")
	strPage := query.Get("page")
	strPerPage := query.Get("per_page")

	// check for permission `manage_system`
	userID := getUserID(r)
	if !a.permissions.HasPermissionTo(userID, mm_model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied Compliance Export getAllBoards"))
		return
	}

	// check for valid license feature: compliance
	license := a.app.GetLicense()
	if license == nil || !(*license.Features.Compliance) {
		a.errorResponse(w, r, model.NewErrNotImplemented("insufficient license Compliance Export getAllBoards"))
		return
	}

	// check for valid team if specified
	if teamID != "" {
		_, err := a.app.GetTeam(teamID)
		if err != nil {
			a.errorResponse(w, r, model.NewErrBadRequest("invalid team id: "+teamID))
			return
		}
	}

	if strPage == "" {
		strPage = complianceDefaultPage
	}
	if strPerPage == "" {
		strPerPage = complianceDefaultPerPage
	}
	page, err := strconv.Atoi(strPage)
	if err != nil {
		message := fmt.Sprintf("invalid `page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}
	perPage, err := strconv.Atoi(strPerPage)
	if err != nil {
		message := fmt.Sprintf("invalid `per_page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}

	opts := model.QueryBoardsForComplianceOptions{
		TeamID:  teamID,
		Page:    page,
		PerPage: perPage,
	}

	boards, more, err := a.app.GetBoardsForCompliance(opts)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetBoardsForCompliance",
		mlog.String("teamID", teamID),
		mlog.Int("boardsCount", len(boards)),
		mlog.Bool("hasNext", more),
	)

	response := model.BoardsComplianceResponse{
		HasNext: more,
		Results: boards,
	}
	data, err := json.Marshal(response)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleGetBoardsComplianceHistory(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /admin/boards_history getBoardsComplianceHistory
	//
	// Returns boards histories for a specific team, or all teams.
	//
	// Requires a license that includes Compliance feature. Caller must have `manage_system` permissions.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: modified_since
	//   in: query
	//   description: Filters for boards modified since timestamp; Unix time in milliseconds
	//   required: true
	//   type: integer
	// - name: include_deleted
	//   in: query
	//   description: When true then deleted boards are included. Default=false
	//   required: false
	//   type: boolean
	// - name: team_id
	//   in: query
	//   description: Team ID. If empty then board histories across all teams are included
	//   required: false
	//   type: string
	// - name: page
	//   in: query
	//   description: The page to select (default=0)
	//   required: false
	//   type: integer
	// - name: per_page
	//   in: query
	//   description: Number of board histories to return per page (default=60)
	//   required: false
	//   type: integer
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: object
	//       items:
	//         "$ref": "#/definitions/BoardsComplianceHistoryResponse"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	strModifiedSince := query.Get("modified_since") // required, everything else optional
	includeDeleted := query.Get("include_deleted") == "true"
	strPage := query.Get("page")
	strPerPage := query.Get("per_page")
	teamID := query.Get("team_id")

	if strModifiedSince == "" {
		a.errorResponse(w, r, model.NewErrBadRequest("`modified_since` parameter required"))
		return
	}

	// check for permission `manage_system`
	userID := getUserID(r)
	if !a.permissions.HasPermissionTo(userID, mm_model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied Compliance Export getBoardsHistory"))
		return
	}

	// check for valid license feature: compliance
	license := a.app.GetLicense()
	if license == nil || !(*license.Features.Compliance) {
		a.errorResponse(w, r, model.NewErrNotImplemented("insufficient license Compliance Export getBoardsHistory"))
		return
	}

	// check for valid team if specified
	if teamID != "" {
		_, err := a.app.GetTeam(teamID)
		if err != nil {
			a.errorResponse(w, r, model.NewErrBadRequest("invalid team id: "+teamID))
			return
		}
	}

	if strPage == "" {
		strPage = complianceDefaultPage
	}
	if strPerPage == "" {
		strPerPage = complianceDefaultPerPage
	}
	page, err := strconv.Atoi(strPage)
	if err != nil {
		message := fmt.Sprintf("invalid `page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}
	perPage, err := strconv.Atoi(strPerPage)
	if err != nil {
		message := fmt.Sprintf("invalid `per_page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}
	modifiedSince, err := strconv.ParseInt(strModifiedSince, 10, 64)
	if err != nil {
		message := fmt.Sprintf("invalid `modified_since` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}

	opts := model.QueryBoardsComplianceHistoryOptions{
		ModifiedSince:  modifiedSince,
		IncludeDeleted: includeDeleted,
		TeamID:         teamID,
		Page:           page,
		PerPage:        perPage,
	}

	boards, more, err := a.app.GetBoardsComplianceHistory(opts)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetBoardsComplianceHistory",
		mlog.String("teamID", teamID),
		mlog.Int("boardsCount", len(boards)),
		mlog.Bool("hasNext", more),
	)

	response := model.BoardsComplianceHistoryResponse{
		HasNext: more,
		Results: boards,
	}
	data, err := json.Marshal(response)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) handleGetBlocksComplianceHistory(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /admin/blocks_history getBlocksComplianceHistory
	//
	// Returns block histories for a specific team, specific board, or all teams and boards.
	//
	// Requires a license that includes Compliance feature. Caller must have `manage_system` permissions.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: modified_since
	//   in: query
	//   description: Filters for boards modified since timestamp; Unix time in milliseconds
	//   required: true
	//   type: integer
	// - name: include_deleted
	//   in: query
	//   description: When true then deleted boards are included. Default=false
	//   required: false
	//   type: boolean
	// - name: team_id
	//   in: query
	//   description: Team ID. If empty then block histories across all teams are included
	//   required: false
	//   type: string
	// - name: board_id
	//   in: query
	//   description: Board ID. If empty then block histories for all boards are included
	//   required: false
	//   type: string
	// - name: page
	//   in: query
	//   description: The page to select (default=0)
	//   required: false
	//   type: integer
	// - name: per_page
	//   in: query
	//   description: Number of block histories to return per page (default=60)
	//   required: false
	//   type: integer
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: object
	//       items:
	//         "$ref": "#/definitions/BlocksComplianceHistoryResponse"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	strModifiedSince := query.Get("modified_since") // required, everything else optional
	includeDeleted := query.Get("include_deleted") == "true"
	strPage := query.Get("page")
	strPerPage := query.Get("per_page")
	teamID := query.Get("team_id")
	boardID := query.Get("board_id")

	if strModifiedSince == "" {
		a.errorResponse(w, r, model.NewErrBadRequest("`modified_since` parameter required"))
		return
	}

	// check for permission `manage_system`
	userID := getUserID(r)
	if !a.permissions.HasPermissionTo(userID, mm_model.PermissionManageSystem) {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied Compliance Export getBlocksHistory"))
		return
	}

	// check for valid license feature: compliance
	license := a.app.GetLicense()
	if license == nil || !(*license.Features.Compliance) {
		a.errorResponse(w, r, model.NewErrNotImplemented("insufficient license Compliance Export getBlocksHistory"))
		return
	}

	// check for valid team if specified
	if teamID != "" {
		_, err := a.app.GetTeam(teamID)
		if err != nil {
			a.errorResponse(w, r, model.NewErrBadRequest("invalid team id: "+teamID))
			return
		}
	}

	// check for valid board if specified
	if boardID != "" {
		_, err := a.app.GetBoard(boardID)
		if err != nil {
			a.errorResponse(w, r, model.NewErrBadRequest("invalid board id: "+boardID))
			return
		}
	}

	if strPage == "" {
		strPage = complianceDefaultPage
	}
	if strPerPage == "" {
		strPerPage = complianceDefaultPerPage
	}
	page, err := strconv.Atoi(strPage)
	if err != nil {
		message := fmt.Sprintf("invalid `page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}
	perPage, err := strconv.Atoi(strPerPage)
	if err != nil {
		message := fmt.Sprintf("invalid `per_page` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}
	modifiedSince, err := strconv.ParseInt(strModifiedSince, 10, 64)
	if err != nil {
		message := fmt.Sprintf("invalid `modified_since` parameter: %s", err)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}

	opts := model.QueryBlocksComplianceHistoryOptions{
		ModifiedSince:  modifiedSince,
		IncludeDeleted: includeDeleted,
		TeamID:         teamID,
		BoardID:        boardID,
		Page:           page,
		PerPage:        perPage,
	}

	blocks, more, err := a.app.GetBlocksComplianceHistory(opts)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GetBlocksComplianceHistory",
		mlog.String("teamID", teamID),
		mlog.String("boardID", boardID),
		mlog.Int("blocksCount", len(blocks)),
		mlog.Bool("hasNext", more),
	)

	response := model.BlocksComplianceHistoryResponse{
		HasNext: more,
		Results: blocks,
	}
	data, err := json.Marshal(response)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}
