// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v5/model"

func (a *App) GetUserTermsOfService(userId string) (*model.UserTermsOfService, *model.AppError) {
	return a.Srv.Store.UserTermsOfService().GetByUser(userId)
}

func (a *App) SaveUserTermsOfService(userId, termsOfServiceId string, accepted bool) *model.AppError {
	if accepted {
		userTermsOfService := &model.UserTermsOfService{
			UserId:           userId,
			TermsOfServiceId: termsOfServiceId,
		}

		if _, err := a.Srv.Store.UserTermsOfService().Save(userTermsOfService); err != nil {
			return err
		}
	} else {
		if err := a.Srv.Store.UserTermsOfService().Delete(userId, termsOfServiceId); err != nil {
			return err
		}
	}

	return nil
}
