// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func GetReactionsForPost(postId string) ([]*model.Reaction, *model.AppError) {
	if result := <-Srv.Store.Reaction().GetForPost(postId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Reaction), nil
	}
}
