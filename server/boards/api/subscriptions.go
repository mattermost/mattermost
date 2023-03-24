// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/services/audit"

	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

func (a *API) registerSubscriptionsRoutes(r *mux.Router) {
	// Subscription APIs
	r.HandleFunc("/subscriptions", a.sessionRequired(a.handleCreateSubscription)).Methods("POST")
	r.HandleFunc("/subscriptions/{blockID}/{subscriberID}", a.sessionRequired(a.handleDeleteSubscription)).Methods("DELETE")
	r.HandleFunc("/subscriptions/{subscriberID}", a.sessionRequired(a.handleGetSubscriptions)).Methods("GET")
}

// subscriptions

func (a *API) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /subscriptions createSubscription
	//
	// Creates a subscription to a block for a user. The user will receive change notifications for the block.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: Body
	//   in: body
	//   description: subscription definition
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/Subscription"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//         "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var sub model.Subscription

	if err = json.Unmarshal(requestBody, &sub); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	if err = sub.IsValid(); err != nil {
		a.errorResponse(w, r, model.NewErrBadRequest(err.Error()))
		return
	}

	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	auditRec := a.makeAuditRecord(r, "createSubscription", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("subscriber_id", sub.SubscriberID)
	auditRec.AddMeta("block_id", sub.BlockID)

	// User can only create subscriptions for themselves (for now)
	if session.UserID != sub.SubscriberID {
		a.errorResponse(w, r, model.NewErrBadRequest("userID and subscriberID mismatch"))
		return
	}

	// check for valid block
	_, bErr := a.app.GetBlockByID(sub.BlockID)
	if bErr != nil {
		message := fmt.Sprintf("invalid blockID: %s", bErr)
		a.errorResponse(w, r, model.NewErrBadRequest(message))
		return
	}

	subNew, err := a.app.CreateSubscription(&sub)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("CREATE subscription",
		mlog.String("subscriber_id", subNew.SubscriberID),
		mlog.String("block_id", subNew.BlockID),
	)

	json, err := json.Marshal(subNew)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, json)
	auditRec.Success()
}

func (a *API) handleDeleteSubscription(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /subscriptions/{blockID}/{subscriberID} deleteSubscription
	//
	// Deletes a subscription a user has for a a block. The user will no longer receive change notifications for the block.
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
	// - name: subscriberID
	//   in: path
	//   description: Subscriber ID
	//   required: true
	//   type: string
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
	session := ctx.Value(sessionContextKey).(*model.Session)

	vars := mux.Vars(r)
	blockID := vars["blockID"]
	subscriberID := vars["subscriberID"]

	auditRec := a.makeAuditRecord(r, "deleteSubscription", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)
	auditRec.AddMeta("block_id", blockID)
	auditRec.AddMeta("subscriber_id", subscriberID)

	// User can only delete subscriptions for themselves
	if session.UserID != subscriberID {
		a.errorResponse(w, r, model.NewErrPermission("access denied"))
		return
	}

	if _, err := a.app.DeleteSubscription(blockID, subscriberID); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("DELETE subscription",
		mlog.String("blockID", blockID),
		mlog.String("subscriberID", subscriberID),
	)
	jsonStringResponse(w, http.StatusOK, "{}")

	auditRec.Success()
}

func (a *API) handleGetSubscriptions(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /subscriptions/{subscriberID} getSubscriptions
	//
	// Gets subscriptions for a user.
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: subscriberID
	//   in: path
	//   description: Subscriber ID
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
	//         "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"
	ctx := r.Context()
	session := ctx.Value(sessionContextKey).(*model.Session)

	vars := mux.Vars(r)
	subscriberID := vars["subscriberID"]

	auditRec := a.makeAuditRecord(r, "getSubscriptions", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("subscriber_id", subscriberID)

	// User can only get subscriptions for themselves (for now)
	if session.UserID != subscriberID {
		a.errorResponse(w, r, model.NewErrPermission("access denied"))
		return
	}

	subs, err := a.app.GetSubscriptions(subscriberID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	a.logger.Debug("GET subscriptions",
		mlog.String("subscriberID", subscriberID),
		mlog.Int("count", len(subs)),
	)

	json, err := json.Marshal(subs)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	jsonBytesResponse(w, http.StatusOK, json)

	auditRec.AddMeta("subscription_count", len(subs))
	auditRec.Success()
}
