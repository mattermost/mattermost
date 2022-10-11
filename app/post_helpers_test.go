// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetTimeSortedPostAccessibleBounds(t *testing.T) {
	var postFromCreateAt = func(at int64) *model.Post {
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
		require.True(t, bounds.allAccessible(len(pl.Posts)))
	})

	t.Run("one accessible post returns all accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
			},
			Order: []string{"post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible(len(pl.Posts)))
	})

	t.Run("one inaccessible post returns no accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
			},
			Order: []string{"post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.noAccessible())
	})

	t.Run("all accessible posts returns all accessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
				"post_b": postFromCreateAt(2),
				"post_c": postFromCreateAt(3),
				"post_d": postFromCreateAt(4),
				"post_e": postFromCreateAt(5),
				"post_f": postFromCreateAt(6),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e", "post_f"},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible(len(pl.Posts)))
	})

	t.Run("all inaccessible posts returns all inaccessible posts", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
				"post_b": postFromCreateAt(2),
				"post_c": postFromCreateAt(3),
				"post_d": postFromCreateAt(4),
				"post_e": postFromCreateAt(5),
				"post_f": postFromCreateAt(6),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e", "post_f"},
		}
		bounds := getTimeSortedPostAccessibleBounds(7, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.noAccessible())
	})

	t.Run("all accessible posts returns all accessible posts, descending ordered", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
				"post_b": postFromCreateAt(2),
				"post_c": postFromCreateAt(3),
				"post_d": postFromCreateAt(4),
				"post_e": postFromCreateAt(5),
				"post_f": postFromCreateAt(6),
			},
			Order: []string{"post_f", "post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(0, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.allAccessible(len(pl.Posts)))
	})

	t.Run("all inaccessible posts returns all inaccessible posts, descending ordered", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
				"post_b": postFromCreateAt(2),
				"post_c": postFromCreateAt(3),
				"post_d": postFromCreateAt(4),
				"post_e": postFromCreateAt(5),
				"post_f": postFromCreateAt(6),
			},
			Order: []string{"post_f", "post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(7, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.True(t, bounds.noAccessible())
	})

	t.Run("two posts, first accessible", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(1),
				"post_b": postFromCreateAt(0),
			},
			Order: []string{"post_a", "post_b"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, accessibleBounds{start: 0, end: 0}, bounds)
	})

	t.Run("two posts, second accessible", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
			},
			Order: []string{"post_a", "post_b"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, accessibleBounds{start: 1, end: 1}, bounds)
	})

	t.Run("picks the left most post for boundaries when there are time ties", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(1),
				"post_d": postFromCreateAt(2),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, accessibleBounds{start: 1, end: len(pl.Posts) - 1}, bounds)
	})

	t.Run("picks the right most post for boundaries when there are time ties, descending ordered", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(1),
				"post_d": postFromCreateAt(2),
			},
			Order: []string{"post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(1, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, accessibleBounds{start: 0, end: 2}, bounds)
	})

	t.Run("odd number of posts and reverse time selects right boundaries", func(t *testing.T) {
		pl := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(2),
				"post_d": postFromCreateAt(3),
				"post_e": postFromCreateAt(4),
			},
			Order: []string{"post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		bounds := getTimeSortedPostAccessibleBounds(2, len(pl.Posts), getPostListCreateAtFunc(pl))
		require.Equal(t, accessibleBounds{start: 0, end: 2}, bounds)
	})

	t.Run("posts-slice: odd number of posts and reverse time selects right boundaries", func(t *testing.T) {
		posts := []*model.Post{postFromCreateAt(4), postFromCreateAt(3), postFromCreateAt(2), postFromCreateAt(1), postFromCreateAt(0)}
		bounds := getTimeSortedPostAccessibleBounds(2, len(posts), func(i int) int64 { return posts[i].CreateAt })
		require.Equal(t, accessibleBounds{start: 0, end: 2}, bounds)
	})
}

func TestFilterInaccessiblePosts(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	var postFromCreateAt = func(at int64) *model.Post {
		return &model.Post{CreateAt: at}
	}

	t.Run("ascending order returns correct posts", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(2),
				"post_d": postFromCreateAt(3),
				"post_e": postFromCreateAt(4),
			},
			Order: []string{"post_a", "post_b", "post_c", "post_d", "post_e"},
		}
		appErr := th.App.filterInaccessiblePosts(th.Context, postList, filterPostOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": postFromCreateAt(2),
			"post_d": postFromCreateAt(3),
			"post_e": postFromCreateAt(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_c",
			"post_d",
			"post_e",
		}, postList.Order)
		assert.Equal(t, int64(1), postList.FirstInaccessiblePostTime)
	})

	t.Run("descending order returns correct posts", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(2),
				"post_d": postFromCreateAt(3),
				"post_e": postFromCreateAt(4),
			},
			Order: []string{"post_e", "post_d", "post_c", "post_b", "post_a"},
		}
		appErr := th.App.filterInaccessiblePosts(th.Context, postList, filterPostOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": postFromCreateAt(2),
			"post_d": postFromCreateAt(3),
			"post_e": postFromCreateAt(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_e",
			"post_d",
			"post_c",
		}, postList.Order)

		assert.Equal(t, int64(1), postList.FirstInaccessiblePostTime)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		postList := &model.PostList{
			Posts: map[string]*model.Post{
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(2),
				"post_d": postFromCreateAt(3),
				"post_e": postFromCreateAt(4),
			},
			Order: []string{"post_e", "post_b", "post_a", "post_d", "post_c"},
		}
		appErr := th.App.filterInaccessiblePosts(th.Context, postList, filterPostOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_c": postFromCreateAt(2),
			"post_d": postFromCreateAt(3),
			"post_e": postFromCreateAt(4),
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
				"post_a": postFromCreateAt(0),
				"post_b": postFromCreateAt(1),
				"post_c": postFromCreateAt(1),
				"post_d": postFromCreateAt(3),
				"post_e": postFromCreateAt(4),
			},
			Order: []string{"post_e", "post_a", "post_d", "post_b"},
		}
		appErr := th.App.filterInaccessiblePosts(th.Context, postList, filterPostOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.Post{
			"post_d": postFromCreateAt(3),
			"post_e": postFromCreateAt(4),
		}, postList.Posts)

		assert.Equal(t, []string{
			"post_e",
			"post_d",
		}, postList.Order)
	})
}

func TestGetFilteredAccessiblePosts(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	var postFromCreateAt = func(at int64) *model.Post {
		return &model.Post{CreateAt: at}
	}

	t.Run("ascending order returns correct posts", func(t *testing.T) {
		posts := []*model.Post{postFromCreateAt(0), postFromCreateAt(1), postFromCreateAt(2), postFromCreateAt(3), postFromCreateAt(4)}
		filteredPosts, firstInaccessiblePostTime, appErr := th.App.getFilteredAccessiblePosts(th.Context, posts, filterPostOptions{assumeSortedCreatedAt: true})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{postFromCreateAt(2), postFromCreateAt(3), postFromCreateAt(4)}, filteredPosts)
		assert.Equal(t, int64(1), firstInaccessiblePostTime)
	})

	t.Run("descending order returns correct posts", func(t *testing.T) {
		posts := []*model.Post{postFromCreateAt(4), postFromCreateAt(3), postFromCreateAt(2), postFromCreateAt(1), postFromCreateAt(0)}
		filteredPosts, firstInaccessiblePostTime, appErr := th.App.getFilteredAccessiblePosts(th.Context, posts, filterPostOptions{assumeSortedCreatedAt: true})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{postFromCreateAt(4), postFromCreateAt(3), postFromCreateAt(2)}, filteredPosts)
		assert.Equal(t, int64(1), firstInaccessiblePostTime)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		posts := []*model.Post{postFromCreateAt(4), postFromCreateAt(1), postFromCreateAt(0), postFromCreateAt(3), postFromCreateAt(2)}
		filteredPosts, _, appErr := th.App.getFilteredAccessiblePosts(th.Context, posts, filterPostOptions{assumeSortedCreatedAt: false})

		assert.Nil(t, appErr)
		assert.Equal(t, []*model.Post{postFromCreateAt(4), postFromCreateAt(3), postFromCreateAt(2)}, filteredPosts)
	})
}

func TestIsInaccessiblePost(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessiblePostTime,
		Value: "2",
	})

	defer th.TearDown()

	post := &model.Post{CreateAt: 3}
	firstInaccessiblePostTime, appErr := th.App.isInaccessiblePost(th.Context, post)
	assert.Nil(t, appErr)
	assert.Equal(t, int64(0), firstInaccessiblePostTime)

	post = &model.Post{CreateAt: 1}
	firstInaccessiblePostTime, appErr = th.App.isInaccessiblePost(th.Context, post)
	assert.Nil(t, appErr)
	assert.Equal(t, int64(1), firstInaccessiblePostTime)
}

func Test_getInaccessibleRange(t *testing.T) {
	type test struct {
		label         string
		bounds        accessibleBounds
		listLength    int
		expectedStart int
		expectedEnd   int
	}
	tests := []test{
		{
			label:         "inaccessible at end",
			bounds:        accessibleBounds{start: 0, end: 3},
			listLength:    6,
			expectedStart: 4,
			expectedEnd:   5,
		},
	}

	for _, test := range tests {
		t.Run(test.label, func(t *testing.T) {
			start, end := test.bounds.getInaccessibleRange(test.listLength)

			assert.Equal(t, test.expectedStart, start)
			assert.Equal(t, test.expectedEnd, end)
		})
	}
}
