// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_getTimeSortedPostAccessibleBounds(t *testing.T) {
	var p = func(at int64) *model.Post {
		return &model.Post{CreateAt: at}
	}

	getPostListCreateAtFunc := func(pl *model.PostList) func(i int) int64 {
		return func(i int) int64 {
			return pl.Posts[pl.Order[i]].CreateAt
		}
	}

	t.Run("empty posts returns all accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{},
			Order: []string{},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible())
	})

	t.Run("one accessible post returns all accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(1),
			},
			Order: []string{"post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible())
	})

	t.Run("one inaccessible post returns no accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
			},
			Order: []string{"post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allInaccessible())
	})

	t.Run("all accessible posts returns all accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(1),
				"post_b": p(2),
				"post_c": p(3),
				"post_d": p(4),
				"post_e": p(5),
				"post_f": p(6),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e", "post_f"},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible())
	})

	t.Run("all inaccessible posts returns all inaccessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(1),
				"post_b": p(2),
				"post_c": p(3),
				"post_d": p(4),
				"post_e": p(5),
				"post_f": p(6),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e", "post_f"},
		}
		bounds := getTimeSortedPostAccessibleBounds(7, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allInaccessible())
	})

	t.Run("two posts, first accessible", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(1),
				"post_b": p(0),
			},
			Order: []string{"post_a", "post_b"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, postAccessibleBounds{accessible: 0, inaccessible: 1}, bounds)
	})

	t.Run("two posts, second accessible", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
			},
			Order: []string{"post_a", "post_b"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, postAccessibleBounds{accessible: 1, inaccessible: 0}, bounds)
	})

	t.Run("picks the right post for boundaries when there are time ties", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(1),
				"post_d": p(2),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d"},
		}
		bounds := getTimeSortedPostAccessibleBounds(2, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, postAccessibleBounds{accessible: 3, inaccessible: 2}, bounds)
	})

	t.Run("picks the right post for boundaries when there are time ties, reverse order", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(1),
				"post_d": p(2),
			},
			Order: []string{"post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(2, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, postAccessibleBounds{accessible: 0, inaccessible: 1}, bounds)
	})

	t.Run("odd number of posts and reverse time selects right boundaries", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(2),
				"post_d": p(3),
				"post_e": p(4),
			},
			Order: []string{"post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(2, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, postAccessibleBounds{accessible: 2, inaccessible: 3}, bounds)
	})

	t.Run("posts-slice: odd number of posts and reverse time selects right boundaries", func(t *testing.T) {
		posts := []*model.Post{p(4), p(3), p(2), p(1), p(0)}
		bounds := getTimeSortedPostAccessibleBounds(2, len(posts), func(i int) int64 { return posts[i].CreateAt })
		require.Equal(t, postAccessibleBounds{accessible: 2, inaccessible: 3}, bounds)
	})
}

func Test_filterInaccessiblePosts(t *testing.T) {
	th := Setup(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store.System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	var p = func(at int64) *model.Post {
		return &model.Post{CreateAt: at}
	}

	t.Run("ascending order returns correct posts", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(2),
				"post_d": p(3),
				"post_e": p(4),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e"},
		}
		appErr := th.App.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": p(2),
			"post_d": p(3),
			"post_e": p(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_c",
			"post_d",
			"post_e",
		}, postList.Order)
	})

	t.Run("descending order returns correct posts", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(2),
				"post_d": p(3),
				"post_e": p(4),
			},
			Order: []string{"post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		appErr := th.App.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": p(2),
			"post_d": p(3),
			"post_e": p(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_e",
			"post_d",
			"post_c",
		}, postList.Order)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(2),
				"post_d": p(3),
				"post_e": p(4),
			},
			Order: []string{"post_e", "post_b", "post_a", "post_d", "post_c"},
		}
		appErr := th.App.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": p(2),
			"post_d": p(3),
			"post_e": p(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_e",
			"post_d",
			"post_c",
		}, postList.Order)
	})

	t.Run("handles posts missing from order when doing linear search", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": p(0),
				"post_b": p(1),
				"post_c": p(1),
				"post_d": p(3),
				"post_e": p(4),
			},
			Order: []string{"post_e", "post_a", "post_d", "post_b"},
		}
		appErr := th.App.filterInaccessiblePosts(postList, filterPostOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_d": p(3),
			"post_e": p(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_e",
			"post_d",
		}, postList.Order)
	})
}

func Test_getFilteredAccessiblePosts(t *testing.T) {
	th := Setup(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store.System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	var p = func(at int64) *model.Post {
		return &model.Post{CreateAt: at}
	}

	t.Run("ascending order returns correct posts", func(t *testing.T) {
		posts := []*model.Post{p(0), p(1), p(2), p(3), p(4)}
		filteredPosts, _, appErr := th.App.getFilteredAccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: true})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{p(2), p(3), p(4)}, filteredPosts)
	})

	t.Run("descending order returns correct posts", func(t *testing.T) {
		posts := []*model.Post{p(4), p(3), p(2), p(1), p(0)}
		filteredPosts, _, appErr := th.App.getFilteredAccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: true})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{p(4), p(3), p(2)}, filteredPosts)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		posts := []*model.Post{p(4), p(1), p(0), p(3), p(2)}
		filteredPosts, _, appErr := th.App.getFilteredAccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: false})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{p(4), p(3), p(2)}, filteredPosts)
	})
}

func Test_isInaccessiblePost(t *testing.T) {
	th := Setup(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store.System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	post := &model.Post{CreateAt: 3}
	r, appErr := th.App.isInaccessiblePost(post)
	assert.Nil(t, appErr)
	assert.Equal(t, false, r)

	post = &model.Post{CreateAt: 1}
	r, appErr = th.App.isInaccessiblePost(post)
	assert.Nil(t, appErr)
	assert.Equal(t, true, r)
}
