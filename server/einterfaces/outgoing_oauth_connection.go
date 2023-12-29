// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OutgoingOAuthConnectionInterface interface {
	DeleteConnection(rctx request.CTX, id string) *model.AppError
	GetConnection(rctx request.CTX, id string) (*model.OutgoingOAuthConnection, *model.AppError)
	GetConnections(rctx request.CTX, filters model.OutgoingOAuthConnectionGetConnectionsFilter) ([]*model.OutgoingOAuthConnection, *model.AppError)
	SaveConnection(rctx request.CTX, conn *model.OutgoingOAuthConnection) (*model.OutgoingOAuthConnection, *model.AppError)
	UpdateConnection(rctx request.CTX, conn *model.OutgoingOAuthConnection) (*model.OutgoingOAuthConnection, *model.AppError)

	SanitizeConnection(conn *model.OutgoingOAuthConnection)
	SanitizeConnections(conns []*model.OutgoingOAuthConnection)

	GetConnectionForAudience(rctx request.CTX, url string) (*model.OutgoingOAuthConnection, *model.AppError)
	RetrieveTokenForConnection(rctx request.CTX, conn *model.OutgoingOAuthConnection) (*model.OutgoingOAuthConnectionToken, *model.AppError)
}
