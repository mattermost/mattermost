// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) CreateTermsOfService(text, userId string) (*model.ServiceTerms, *model.AppError) {
	termsOfService := &model.ServiceTerms{
		Text:   text,
		UserId: userId,
	}

	if _, err := a.GetUser(userId); err != nil {
		return nil, err
	}

	result := <-a.Srv.Store.TermsOfService().Save(termsOfService)
	if result.Err != nil {
		return nil, result.Err
	}

	termsOfService = result.Data.(*model.ServiceTerms)
	return termsOfService, nil
}

func (a *App) GetLatestTermsOfService() (*model.ServiceTerms, *model.AppError) {
	if result := <-a.Srv.Store.TermsOfService().GetLatest(true); result.Err != nil {
		return nil, result.Err
	} else {
		termsOfService := result.Data.(*model.ServiceTerms)
		return termsOfService, nil
	}
}

func (a *App) GetTermsOfService(id string) (*model.ServiceTerms, *model.AppError) {
	if result := <-a.Srv.Store.TermsOfService().Get(id, true); result.Err != nil {
		return nil, result.Err
	} else {
		termsOfService := result.Data.(*model.ServiceTerms)
		return termsOfService, nil
	}
}
