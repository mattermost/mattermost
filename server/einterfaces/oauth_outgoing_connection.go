package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type OutgoingOAuthConnectionInterface interface {
	DeleteConnection(rctx request.CTX, id string) *model.AppError
	GetConnection(rctx request.CTX, id string) (*model.OutgoingOAuthConnectionGrantType, *model.AppError)
	GetConnections(rctx request.CTX, filters model.OutgoingOAuthConnectionGetConnectionsFilter) ([]*model.OutgoingOAuthConnectionGrantType, *model.AppError)
	SaveConnection(rctx request.CTX, conn *model.OutgoingOAuthConnectionGrantType) (*model.OutgoingOAuthConnectionGrantType, *model.AppError)
	UpdateConnection(rctx request.CTX, conn *model.OutgoingOAuthConnectionGrantType) (*model.OutgoingOAuthConnectionGrantType, *model.AppError)
}
