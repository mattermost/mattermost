package app

import (
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) CreateServiceTerms(text, userId string) (*model.ServiceTerms, *model.AppError) {
	serviceTerms := &model.ServiceTerms{
		Text:   text,
		UserId: userId,
	}

	if _, err := a.GetUser(userId); err != nil {
		return nil, err
	}

	if result := <-a.Srv.Store.ServiceTerms().Save(serviceTerms); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}

func (a *App) GetServiceTerms() (*model.ServiceTerms, *model.AppError) {
	if result := <-a.Srv.Store.ServiceTerms().Get(true); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}
