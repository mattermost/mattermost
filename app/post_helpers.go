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
func getTimeSortedPostAccessibleBounds(earliestAccessibleTime int64, lenPosts int, getCreateAt func(int) int64) postAccessibleBounds {
	if lenPosts == 0 {
		return allAccessiblePosts
	}

	if lenPosts == 1 {
		if getCreateAt(0) >= earliestAccessibleTime {
			return allAccessiblePosts
		}
		return noAccessiblePosts
	}

	var firstAccessible = getCreateAt(0) >= earliestAccessibleTime
	var lastAccessible = getCreateAt(lenPosts-1) >= earliestAccessibleTime

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
		guessIsAccessible := getCreateAt(guess) >= earliestAccessibleTime
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

type filterPostOptions struct {
	assumeSortedCreatedAt bool
}

// linearFilterPostList make no assumptions about ordering, go through posts one by one
// this is the slower fallback that is still safe if we we can not
// assume posts are ordered by CreatedAt
func linearFilterPostList(postList *model.PostList, earliestAccessibleTime int64) {
	// filter Posts
	posts := postList.Posts

	newPostOrder := []string{}
	for _, postId := range postList.Order {
		if posts[postId].CreateAt < earliestAccessibleTime {
			postList.HasInaccessiblePosts = true
			delete(posts, postId)
		} else {
			newPostOrder = append(newPostOrder, postId)
		}
	}

	// it can happen that some post list results don't have all posts in the Order field.
	// for example GetPosts in the CollapsedThreads = false path, parents are not added
	// to Order
	for postId := range posts {
		if posts[postId].CreateAt < earliestAccessibleTime {
			postList.HasInaccessiblePosts = true
			delete(posts, postId)
		}
	}

	postList.Order = newPostOrder
}

// linearFilterPostsSlice make no assumptions about ordering, go through posts one by one
// this is the slower fallback that is still safe if we we can not
// assume posts are ordered by CreatedAt
func linearFilterPostsSlice(posts []*model.Post, earliestAccessibleTime int64) (filteredPosts []*model.Post, hasInaccessiblePosts bool) {
	filteredPosts = make([]*model.Post, 0, len(posts))
	for i := range posts {
		if posts[i].CreateAt < earliestAccessibleTime {
			hasInaccessiblePosts = true
		} else {
			filteredPosts = append(filteredPosts, posts[i])
		}
	}
	return
}

// filterInaccessiblePosts filters out the posts, past the cloud limit
func (a *App) filterInaccessiblePosts(postList *model.PostList, options filterPostOptions) *model.AppError {
	if postList == nil || postList.Posts == nil || len(postList.Posts) == 0 {
		return nil
	}

	lastAccessiblePostTime, appErr := a.GetLastAccessiblePostTime()
	if appErr != nil {
		return model.NewAppError("filterInaccessiblePosts", "app.last_accessible_post.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	} else if lastAccessiblePostTime == 0 {
		// No need to filter, all posts are accessible
		return nil
	}

	if len(postList.Posts) == len(postList.Order) && options.assumeSortedCreatedAt {
		count := len(postList.Posts)
		getCreateAt := func(i int) int64 { return postList.Posts[postList.Order[i]].CreateAt }
		bounds := getTimeSortedPostAccessibleBounds(lastAccessiblePostTime, count, getCreateAt)
		if bounds.allAccessible() {
			return nil
		}
		if bounds.allInaccessible() {
			if count > 0 {
				postList.HasInaccessiblePosts = true
			}
			postList.Posts = map[string]*model.Post{}
			postList.Order = []string{}
			return nil
		}
		postList.HasInaccessiblePosts = true

		var otherInaccessibleBound int
		var otherAccessibleBound int
		if bounds.accessible > bounds.inaccessible {
			otherInaccessibleBound = 0
			otherAccessibleBound = count - 1
		} else {
			otherInaccessibleBound = count - 1
			otherAccessibleBound = 0
		}

		order := postList.Order
		inaccessibleCount := maxInt(bounds.inaccessible, otherInaccessibleBound) - min(bounds.inaccessible, otherInaccessibleBound)
		accessibleCount := maxInt(bounds.accessible, otherAccessibleBound) - min(bounds.accessible, otherAccessibleBound)
		// Linearly cover shorter route
		if inaccessibleCount < accessibleCount {
			for i := min(bounds.inaccessible, otherInaccessibleBound); i <= maxInt(bounds.inaccessible, otherInaccessibleBound); i++ {
				delete(postList.Posts, order[i])
			}
		} else {
			accessiblePosts := make(map[string]*model.Post, accessibleCount+1)
			for i := min(bounds.accessible, otherAccessibleBound); i <= maxInt(bounds.accessible, otherAccessibleBound); i++ {
				accessiblePosts[order[i]] = postList.Posts[order[i]]
			}
			postList.Posts = accessiblePosts
		}

		postList.Order = postList.Order[min(bounds.accessible, otherAccessibleBound) : maxInt(bounds.accessible, otherAccessibleBound)+1]
	} else {
		linearFilterPostList(postList, lastAccessiblePostTime)
	}

	return nil
}

func (a *App) isInaccessiblePost(post *model.Post) (bool, *model.AppError) {
	if post == nil {
		return false, nil
	}

	pl := &model.PostList{
		Order: []string{post.Id},
		Posts: map[string]*model.Post{post.Id: post},
	}

	return pl.HasInaccessiblePosts, a.filterInaccessiblePosts(pl, filterPostOptions{assumeSortedCreatedAt: true})
}

// getFilteredAccessiblePosts returns accessible posts filtered as per the cloud plan's limit and also indicates if there were any inAccessible posts
func (a *App) getFilteredAccessiblePosts(posts []*model.Post, options filterPostOptions) ([]*model.Post, bool, *model.AppError) {
	filteredPosts := []*model.Post{}
	if len(posts) == 0 {
		return posts, false, nil
	}

	lastAccessiblePostTime, appErr := a.GetLastAccessiblePostTime()
	if appErr != nil {
		return filteredPosts, false, model.NewAppError("filterInaccessiblePostsSlice", "app.last_accessible_post.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	} else if lastAccessiblePostTime == 0 {
		// No need to filter, all posts are accessible
		return posts, false, nil
	}

	if options.assumeSortedCreatedAt {
		lenPosts := len(posts)
		getCreateAt := func(i int) int64 { return posts[i].CreateAt }
		bounds := getTimeSortedPostAccessibleBounds(lastAccessiblePostTime, lenPosts, getCreateAt)
		if bounds.allAccessible() {
			return posts, false, nil
		}
		if bounds.allInaccessible() {
			return filteredPosts, lenPosts > 0, nil
		}

		var otherAccessibleBound int
		if bounds.accessible > bounds.inaccessible {
			otherAccessibleBound = lenPosts - 1
		} else {
			otherAccessibleBound = 0
		}

		filteredPosts = posts[min(bounds.accessible, otherAccessibleBound) : maxInt(bounds.accessible, otherAccessibleBound)+1]
		return filteredPosts, true, nil
	}
	filteredPosts, hasInaccessiblePosts := linearFilterPostsSlice(posts, lastAccessiblePostTime)
	return filteredPosts, hasInaccessiblePosts, nil
}
