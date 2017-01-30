// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func GetPreferencesForUser(userId string) (model.Preferences, *model.AppError) {
	if result := <-Srv.Store.Preference().GetAll(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(model.Preferences), nil
	}
}
