package einterfaces

import "github.com/mattermost/mattermost-server/v5/model"

type LicenseInterface interface {
	CanStartTrial() (bool, *model.AppError)
}
