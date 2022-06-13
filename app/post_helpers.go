// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

type postAccessibleBounds struct {
	accessible   int
	inaccessible int
}

func (p postAccessibleBounds) allAccessible() bool {
	return p.accessible == allAccessiblePosts.accessible && p.inaccessible == allAccessiblePosts.inaccessible
}

func (p postAccessibleBounds) allInaccessible() bool {
	return p.accessible == noAccessiblePosts.accessible && p.inaccessible == noAccessiblePosts.inaccessible
}

var noAccessiblePosts = postAccessibleBounds{accessible: -1, inaccessible: 0}
var allAccessiblePosts = postAccessibleBounds{accessible: 0, inaccessible: -1}

func getDistance(a, b int) int {
	if a-b > 0 {
		return a - b
	}
	return b - a
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// getTimeSortedPostAccessibleBounds returns what the boundaries for accessible and inaccessible posts.
// It assumes that CreateAt time for posts is monotonically increasing or decreasing.
// It could be either because posts can be returned in ascending or descending time order.
// Because it returns the boundaries, it is necessary to check whether the accessible or
// inaccessible post index is greater, and do the filtering accordingly.
// Special values (which can be checked with methods `allAccessible` and `allInaccessible`)
// denote if all or none of the posts are accessible
func getTimeSortedPostAccessibleBounds(postList *model.PostList, earliestAccessibleTime int64) postAccessibleBounds {
	if postList == nil || postList.Posts == nil || len(postList.Posts) == 0 {
		return allAccessiblePosts
	}
	posts := postList.Posts
	order := postList.Order
	lenPosts := len(posts)

	if lenPosts != len(order) {
		return allAccessiblePosts
	}
	if lenPosts == 1 {
		if posts[order[0]].CreateAt >= earliestAccessibleTime {
			return allAccessiblePosts
		}
		return noAccessiblePosts
	}

	var firstAccessible = posts[order[0]].CreateAt >= earliestAccessibleTime
	var lastAccessible = posts[order[lenPosts-1]].CreateAt >= earliestAccessibleTime

	if firstAccessible == lastAccessible {
		if firstAccessible {
			return allAccessiblePosts
		}
		return noAccessiblePosts
	}

	var accessible = -1
	var inaccessible = -1
	if firstAccessible {
		accessible = 0
	} else {
		inaccessible = 0
	}
	if lastAccessible {
		accessible = lenPosts - 1
	} else {
		inaccessible = lenPosts - 1
	}

	for {
		distance := getDistance(accessible, inaccessible)
		if distance == 1 {
			break
		}
		guess := min(accessible, inaccessible) + distance/2
		guessIsAccessible := posts[order[guess]].CreateAt >= earliestAccessibleTime
		if guessIsAccessible {
			accessible = guess
		} else {
			inaccessible = guess
		}
	}

	return postAccessibleBounds{
		accessible:   accessible,
		inaccessible: inaccessible,
	}
}

// filterInaccessiblePosts filters out the posts, past the cloud limit
func (a *App) filterInaccessiblePosts(postList *model.PostList) *model.AppError {
	lastAccessiblePostTime, appErr := a.GetLastAccessiblePostTime(true)
	if appErr != nil {
		return model.NewAppError("filterInaccessiblePosts", "app.last_accessible_post.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	} else if lastAccessiblePostTime == 0 {
		// No need to filter, all posts are accessible
		return nil
	}

	bounds := getTimeSortedPostAccessibleBounds(postList, lastAccessiblePostTime)
	if bounds.allAccessible() {
		return nil
	}
	if bounds.allInaccessible() {
		postList.Posts = map[string]*model.Post{}
		postList.Order = []string{}
		if len(postList.Posts) > 0 {
			postList.HasInaccessiblePosts = true
		}
		return nil
	}
	postList.HasInaccessiblePosts = true

	var otherInaccessibleBound int
	var otherAccessibleBound int
	if bounds.accessible > bounds.inaccessible {
		otherInaccessibleBound = 0
		otherAccessibleBound = len(postList.Order) - 1
	} else {
		otherInaccessibleBound = len(postList.Order) - 1
		otherAccessibleBound = 0
	}
	order := postList.Order
	for i := min(bounds.inaccessible, otherInaccessibleBound); i <= maxInt(bounds.inaccessible, otherInaccessibleBound); i++ {
		delete(postList.Posts, order[i])
	}

	postList.Order = postList.Order[min(bounds.accessible, otherAccessibleBound) : maxInt(bounds.accessible, otherAccessibleBound)+1]

	return nil
}
