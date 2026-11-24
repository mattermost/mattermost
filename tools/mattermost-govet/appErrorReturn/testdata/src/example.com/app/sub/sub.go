package sub

import "github.com/mattermost/mattermost/server/public/model"

func Baselined() *model.AppError { return nil }

func Unlisted() *model.AppError { // want `Unlisted returns \*model.AppError`
	return nil
}
