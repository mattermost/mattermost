// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import "github.com/mattermost/mattermost-server/model"

func (a *App) GetUserTermsOfService(userId string) (*model.UserTermsOfService, *model.AppError) {
	if result := <-a.Srv.Store.UserTermsOfService().GetByUser(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.UserTermsOfService), nil
	}
}

func (a *App) SaveUserTermsOfService(userId, termsOfServiceId string, accepted bool) *model.AppError {
	if accepted {
		userTermsOfService := &model.UserTermsOfService{
			UserId:           userId,
			TermsOfServiceId: termsOfServiceId,
		}

		if result := <-a.Srv.Store.UserTermsOfService().Save(userTermsOfService); result.Err != nil {
			return result.Err
		}
	} else {
		if result := <-a.Srv.Store.UserTermsOfService().Delete(userId, termsOfServiceId); result.Err != nil {
			return result.Err
		}
	}

	return nil
}
