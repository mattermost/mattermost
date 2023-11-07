package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OAuthOutgoingConnectionInterface interface {
	DeleteConnection(rctx request.CTX, id string) *model.AppError
	GetConnection(rctx request.CTX, id string) (*model.OAuthOutgoingConnection, *model.AppError)
	GetConnections(rctx request.CTX, filters model.OAuthOutgoingConnectionGetConnectionsFilter) ([]*model.OAuthOutgoingConnection, *model.AppError)
	SaveConnection(rctx request.CTX, conn *model.OAuthOutgoingConnection) (*model.OAuthOutgoingConnection, *model.AppError)
	UpdateConnection(rctx request.CTX, conn *model.OAuthOutgoingConnection) (*model.OAuthOutgoingConnection, *model.AppError)
}
