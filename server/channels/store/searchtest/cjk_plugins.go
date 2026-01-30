// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestSearchPostStoreEnabledCJK(t *testing.T, s store.Store) {
	th := &SearchTestHelper{
		Context: request.TestContext(t),
		Store:   s,
	}
	err := th.SetupBasicFixtures()
	require.NoError(t, err)
	defer th.CleanFixtures()

	t.Run("Korean searches using nori analyzer", func(t *testing.T) {
		t.Run("should be able to search with wildcard and exact search", func(t *testing.T) {
			p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "한글", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "한국", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// Exact search
			params := &model.SearchParams{Terms: "한글"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)

			// Wildcard search
			params = &model.SearchParams{Terms: "한*"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})

		t.Run("should search one word and phrase with Nori segmentation", func(t *testing.T) {
			pBul, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "불", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			pBulda, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "불다", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "소고기덮밥", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			p4, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "치킨덮밥", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// One word "불": Nori segments "불다" into "불"+"다", so "불" matches both posts
			params := &model.SearchParams{Terms: "불"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, pBul.Id, results.Posts)
			th.checkPostInSearchResults(t, pBulda.Id, results.Posts)

			// Unquoted "불다": SimpleQueryString treats one term as OR of analyzed tokens (불 OR 다), so both posts match
			params = &model.SearchParams{Terms: "불다"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, pBul.Id, results.Posts)
			th.checkPostInSearchResults(t, pBulda.Id, results.Posts)

			// Unquoted 덮밥 should match 소고기덮밥 and 치킨덮밥
			params = &model.SearchParams{Terms: "덮밥"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p3.Id, results.Posts)
			th.checkPostInSearchResults(t, p4.Id, results.Posts)
		})

		t.Run("should search in mixed Korean and English content", func(t *testing.T) {
			p5, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "오늘 회의실 예약 meeting", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "회의실"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p5.Id, results.Posts)
		})

		t.Run("should search using phrase search", func(t *testing.T) {
			p6, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "오늘 회의실 예약", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "\"오늘 회의실\""}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p6.Id, results.Posts)
		})
	})

	t.Run("Japanese searches using kuromoji analyzer", func(t *testing.T) {
		t.Run("should be able to search using wildcard and exact search", func(t *testing.T) {
			p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "東京", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "東北", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// Exact match
			params := &model.SearchParams{Terms: "東京"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)

			// Wildcard search
			params = &model.SearchParams{Terms: "東*"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})

		t.Run("should search in mixed Japanese and English content", func(t *testing.T) {
			p4, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "projectの締め切りは来週", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "締め切り"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p4.Id, results.Posts)
		})

		t.Run("should search using phrase search", func(t *testing.T) {
			p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "今日の会議は中止です", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "\"今日の会議\""}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p3.Id, results.Posts)
		})

		t.Run("should find conjugated verb forms when searching infinitive", func(t *testing.T) {
			// Create posts with different verb conjugations
			pInfinitive, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "食べる", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			pPast, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "昨日ラーメンを食べました", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			pTe, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "食べている", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			pNegative, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "食べない", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// Search for infinitive form should find all conjugated forms
			params := &model.SearchParams{Terms: "食べる"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 4)
			th.checkPostInSearchResults(t, pInfinitive.Id, results.Posts)
			th.checkPostInSearchResults(t, pPast.Id, results.Posts)
			th.checkPostInSearchResults(t, pTe.Id, results.Posts)
			th.checkPostInSearchResults(t, pNegative.Id, results.Posts)
		})
	})

	t.Run("Chinese searches using smartcn analyzer", func(t *testing.T) {
		t.Run("should be able to search using wildcard and exact search", func(t *testing.T) {
			p1, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "电脑", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			p2, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "电话", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// Exact search
			params := &model.SearchParams{Terms: "电脑"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)

			// Wildcard search
			params = &model.SearchParams{Terms: "电*"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, p1.Id, results.Posts)
			th.checkPostInSearchResults(t, p2.Id, results.Posts)
		})

		t.Run("should search one and two characters with SmartCN segmentation (你 / 你好)", func(t *testing.T) {
			pNiHao, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "你好", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			pNi, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "你", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			// One character: SmartCN segments "你好" into "你"+"好", so "你" matches both
			params := &model.SearchParams{Terms: "你"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, pNi.Id, results.Posts)
			th.checkPostInSearchResults(t, pNiHao.Id, results.Posts)

			// Two characters (unquoted): SimpleQueryString matches any analyzed token (你 OR 好), so both posts match
			params = &model.SearchParams{Terms: "你好"}
			results, err = th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 2)
			th.checkPostInSearchResults(t, pNi.Id, results.Posts)
			th.checkPostInSearchResults(t, pNiHao.Id, results.Posts)
		})

		t.Run("should search in mixed Chinese and English content", func(t *testing.T) {
			p3, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "this is 今天开会讨论API接口 content", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "接口"}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p3.Id, results.Posts)
		})

		t.Run("should search using phrase search", func(t *testing.T) {
			p4, err := th.createPost(th.User.Id, th.ChannelBasic.Id, "this is 今天开会讨论API接口 content", "", model.PostTypeDefault, 0, false)
			require.NoError(t, err)
			defer th.deleteUserPosts(th.User.Id)

			params := &model.SearchParams{Terms: "\"今天开会\""}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, th.Team.Id, 0, 20)
			require.NoError(t, err)
			require.Len(t, results.Posts, 1)
			th.checkPostInSearchResults(t, p4.Id, results.Posts)
		})
	})
}
