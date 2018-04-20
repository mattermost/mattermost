// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import "github.com/mattermost/mattermost-server/model"

func (a *App) GetScheme(id string) (*model.Scheme, *model.AppError) {
	if result := <-a.Srv.Store.Scheme().Get(id); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Scheme), nil
	}
}
