// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/audit"
)

// makeAuditRecord creates an audit record pre-populated with data from the request.
func (a *API) makeAuditRecord(r *http.Request, event string, initialStatus string) *audit.Record { //nolint:unparam
	ctx := r.Context()
	var sessionID string
	var userID string
	if session, ok := ctx.Value(sessionContextKey).(*model.Session); ok {
		sessionID = session.ID
		userID = session.UserID
	}

	teamID := "unknown"
	rec := &audit.Record{
		APIPath:   r.URL.Path,
		Event:     event,
		Status:    initialStatus,
		UserID:    userID,
		SessionID: sessionID,
		Client:    r.UserAgent(),
		IPAddress: r.RemoteAddr,
		Meta:      []audit.Meta{{K: audit.KeyTeamID, V: teamID}},
	}

	return rec
}
