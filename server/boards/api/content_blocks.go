// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/audit"
)

func (a *API) registerContentBlocksRoutes(r *mux.Router) {
	// Blocks APIs
	r.HandleFunc("/content-blocks/{blockID}/moveto/{where}/{dstBlockID}", a.sessionRequired(a.handleMoveBlockTo)).Methods("POST")
}

func (a *API) handleMoveBlockTo(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /content-blocks/{blockID}/move/{where}/{dstBlockID} moveBlockTo
	//
	// Move a block after another block in the parent card
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: blockID
	//   in: path
	//   description: Block ID
	//   required: true
	//   type: string
	// - name: where
	//   in: path
	//   description: Relative location respect destination block (after or before)
	//   required: true
	//   type: string
	// - name: dstBlockID
	//   in: path
	//   description: Destination Block ID
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
	//         "$ref": "#/definitions/Block"
	//   '404':
	//     description: board or block not found
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	blockID := mux.Vars(r)["blockID"]
	dstBlockID := mux.Vars(r)["dstBlockID"]
	where := mux.Vars(r)["where"]
	userID := getUserID(r)

	block, err := a.app.GetBlockByID(blockID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	dstBlock, err := a.app.GetBlockByID(dstBlockID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if where != "after" && where != "before" {
		a.errorResponse(w, r, model.NewErrBadRequest("invalid where parameter, use before or after"))
		return
	}

	if userID == "" {
		a.errorResponse(w, r, model.NewErrUnauthorized("access denied to board"))
		return
	}

	if !a.permissions.HasPermissionToBoard(userID, block.BoardID, model.PermissionManageBoardCards) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to modify board cards"))
		return
	}

	auditRec := a.makeAuditRecord(r, "moveBlockTo", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("blockID", blockID)
	auditRec.AddMeta("dstBlockID", dstBlockID)

	err = a.app.MoveContentBlock(block, dstBlock, where, userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	// response
	jsonStringResponse(w, http.StatusOK, "{}")

	auditRec.Success()
}
