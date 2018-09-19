package app

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"strconv"
)

func (a *App) CreateServiceTerms(text, userId string) (*model.ServiceTerms, *model.AppError) {
	serviceTerms := &model.ServiceTerms{
		Text: text,
		UserId: userId,
	}

	if _, err := a.GetUser(userId); err != nil {
		return nil, err
	}

	if result := <- a.Srv.Store.ServiceTerms().Save(serviceTerms); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}

func (a *App) GetServiceTerms() (*model.ServiceTerms, *model.AppError) {
	mlog.Info("AAAAAAAAAAAAAAAAAAAAAA")
	mlog.Info(strconv.FormatBool(a.Srv == nil))
	mlog.Info(strconv.FormatBool(a.Srv.Store == nil))

	if result := <- a.Srv.Store.ServiceTerms().Get(); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}
