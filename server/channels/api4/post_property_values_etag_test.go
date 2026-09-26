// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// get issues a raw GET so the tests can reach endpoints whose typed client method takes no
// propertyGroup, and can read the ETag response header directly. A 304 is not an error here,
// so the status is always worth asserting on.
func (th *postPropertyTestHelper) get(t *testing.T, path, etag string) *http.Response {
	t.Helper()
	resp, err := th.Client.DoAPIGet(context.Background(), path, etag)
	require.NoError(t, err)
	t.Cleanup(func() {
		if resp.Body != nil {
			_ = resp.Body.Close()
		}
	})
	return resp
}

// withGroup appends the propertyGroup parameter that asks for hydration.
func withGroup(path string) string {
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	return path + sep + "propertyGroup=" + model.PostAttributesPropertyGroupName
}

// TestPostPropertyValuesEtagSuppression covers every read handler that hydrates property
// values. Post ETags are derived from Posts.UpdateAt and property values are not, so a
// hydrated response that carried an ETag could be answered from a cache holding values that
// have since changed. Each site is checked twice: hydrated requests must carry no ETag and
// must never answer 304, and requests without the parameter must behave exactly as before.
func TestPostPropertyValuesEtagSuppression(t *testing.T) {
	mainHelper.Parallel(t)

	// Each site is exercised through the same pair of assertions, so a newly added hydrating
	// handler that forgets to suppress its ETag fails here rather than in a browser.
	sites := []struct {
		name string
		path func(th *postPropertyTestHelper) string
	}{
		{
			name: "getPostsForChannel default branch",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?page=0&per_page=60", th.BasicChannel.Id)
			},
		},
		{
			name: "getPostsForChannel after branch",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?after=%s&page=0&per_page=60", th.BasicChannel.Id, th.BasicPost.Id)
			},
		},
		{
			name: "getPostsForChannel before branch",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?before=%s&page=0&per_page=60", th.BasicChannel.Id, th.BasicPost.Id)
			},
		},
		{
			name: "getPostsForChannelAroundLastUnread",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/users/%s/channels/%s/posts/unread?limit_before=30&limit_after=30",
					th.BasicUser.Id, th.BasicChannel.Id)
			},
		},
		{
			name: "getPost",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/posts/%s", th.BasicPost.Id)
			},
		},
		{
			name: "getPostThread",
			path: func(th *postPropertyTestHelper) string {
				return fmt.Sprintf("/posts/%s/thread", th.BasicPost.Id)
			},
		},
	}

	for _, site := range sites {
		t.Run(site.name, func(t *testing.T) {
			th := setupPostPropertyTest(t)
			field := th.createField(t, th.groupID, "sensitivity")
			th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

			// The unread endpoint only reaches its ETag branch once the channel has been
			// read, which is the ordinary state of a channel someone reloads.
			_, _, err := th.Client.ViewChannel(context.Background(), th.BasicUser.Id, &model.ChannelView{ChannelId: th.BasicChannel.Id})
			require.NoError(t, err)

			path := site.path(th)

			// Without the parameter: unchanged. This is the regression that matters, since
			// every existing client relies on it.
			plain := th.get(t, path, "")
			require.Equal(t, http.StatusOK, plain.StatusCode)
			etag := plain.Header.Get(model.HeaderEtagServer)
			require.NotEmpty(t, etag, "an unhydrated response should still carry its ETag")

			revalidated := th.get(t, path, etag)
			assert.Equal(t, http.StatusNotModified, revalidated.StatusCode,
				"an unhydrated request should still be answerable with 304")

			// With the parameter: no ETag to cache against...
			hydrated := th.get(t, withGroup(path), "")
			require.Equal(t, http.StatusOK, hydrated.StatusCode)
			assert.Empty(t, hydrated.Header.Get(model.HeaderEtagServer),
				"a hydrated response must not carry an ETag: it cannot see value changes")

			// ...and an ETag the client already holds is ignored rather than honoured.
			assert.Equal(t, http.StatusOK, th.get(t, withGroup(path), etag).StatusCode,
				"a hydrated request must never be answered with 304")
		})
	}

	// getPost checks the ETag twice, once before the prepare and once after. The two
	// assertions above pin both: an unguarded header write fails the first, and an unguarded
	// early short-circuit fails the second, since it returns 304 before the header is ever
	// reached. This case makes the early one explicit, because a test that only covered the
	// later check would pass with the short-circuit still in place.
	t.Run("getPost does not short-circuit before hydrating", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "sensitivity")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

		post, _, err := th.Client.GetPost(context.Background(), th.BasicPost.Id, "")
		require.NoError(t, err)
		bareEtag := post.Etag()

		path := fmt.Sprintf("/posts/%s", th.BasicPost.Id)
		require.Equal(t, http.StatusNotModified, th.get(t, path, bareEtag).StatusCode,
			"the early check should still answer 304 when nothing is being hydrated")

		hydrated := th.get(t, withGroup(path), bareEtag)
		assert.Equal(t, http.StatusOK, hydrated.StatusCode,
			"the early check must not short-circuit a hydrated request")
	})

	// The reason the whole thing exists. Without suppression this returns the old value.
	t.Run("a value changed after the first read comes back on the next one", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "sensitivity")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

		_, _, err := th.Client.ViewChannel(context.Background(), th.BasicUser.Id, &model.ChannelView{ChannelId: th.BasicChannel.Id})
		require.NoError(t, err)

		opts := model.GetPostsOptions{Page: 0, PerPage: 60, PropertyGroup: model.PostAttributesPropertyGroupName}

		list, resp, err := th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, "", opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, list.Posts[th.BasicPost.Id].Metadata.PropertyValues, 1)
		assert.JSONEq(t, `"confidential"`, string(list.Posts[th.BasicPost.Id].Metadata.PropertyValues[0].Value))

		// A value write touches no post row, so anything derived from Posts.UpdateAt is
		// identical either side of it.
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"public"`)

		list, resp, err = th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, resp.Etag, opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, list.Posts[th.BasicPost.Id].Metadata.PropertyValues, 1)
		assert.JSONEq(t, `"public"`, string(list.Posts[th.BasicPost.Id].Metadata.PropertyValues[0].Value),
			"the second read returned the value from before the change")
	})
}
