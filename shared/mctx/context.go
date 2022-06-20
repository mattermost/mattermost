package mctx

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type Context struct {
	AppContext *request.Context
	Logger     *mlog.Logger
	Err        *model.AppError
}
