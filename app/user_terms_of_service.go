package app

import "github.com/mattermost/mattermost-server/model"

func (a *App) GetUserTermsOfService(userId string) (*model.UserTermsOfService, *model.AppError) {
	if result := <-a.Srv.Store.UserTermsOfService().GetByUser(userId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.UserTermsOfService), nil
	}
}

func (a *App) SaveUserTermsOfService(userId, termsOfServiceId string, accepted bool) *model.AppError {
	userTermsOfService := &model.UserTermsOfService{
		UserId: userId,
	}

	if accepted {
		userTermsOfService.TermsOfServiceId = termsOfServiceId
	}

	if result := <-a.Srv.Store.UserTermsOfService().SaveOrUpdate(userTermsOfService); result.Err != nil {
		return result.Err
	}

	return nil
}
