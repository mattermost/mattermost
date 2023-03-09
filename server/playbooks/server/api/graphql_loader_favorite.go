// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"

	"github.com/graph-gophers/dataloader/v7"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
)

type favoriteInfo struct {
	TeamID string
	UserID string
	ID     string
	Type   app.CategoryItemType
}

func graphQLFavoritesLoader[V bool](ctx context.Context, keys []favoriteInfo) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(keys))
	if len(keys) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		for i := range keys {
			result[i] = &dataloader.Result[V]{Error: err}
		}
		return result
	}

	// assume all keys are for the same team and user
	teamID := keys[0].TeamID
	userID := keys[0].UserID

	categoryItems := make([]app.CategoryItem, len(keys))
	for i, favorite := range keys {
		categoryItems[i] = app.CategoryItem{
			ItemID: favorite.ID,
			Type:   favorite.Type,
		}
	}

	favorites, err := c.categoryService.AreItemsFavorites(categoryItems, teamID, userID)
	if err != nil {
		populateResultWithError(err, result)
	}

	for i, fav := range favorites {
		result[i] = &dataloader.Result[V]{Data: V(fav)}
	}

	return result
}
