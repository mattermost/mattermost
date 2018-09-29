// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	result := <-a.Srv.Store.ServiceTerms().Save(serviceTerms)
	if result.Err != nil {
		return nil, result.Err
	}

	serviceTerms = result.Data.(*model.ServiceTerms)
	return serviceTerms, nil
}

func (a *App) GetLatestServiceTerms() (*model.ServiceTerms, *model.AppError) {
	if result := <-a.Srv.Store.ServiceTerms().GetLatest(true); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}

func (a *App) GetServiceTerms(id string) (*model.ServiceTerms, *model.AppError) {
	if result := <-a.Srv.Store.ServiceTerms().Get(id, true); result.Err != nil {
		return nil, result.Err
	} else {
		serviceTerms := result.Data.(*model.ServiceTerms)
		return serviceTerms, nil
	}
}
