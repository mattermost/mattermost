// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// scopedSearchFixture is a bot-like user searching through a session scope.
// Each channel holds one post and one file matching scopedSearchTerm.
type scopedSearchFixture struct {
	openTeam   *model.Team
	closedTeam *model.Team

	publicOpen   *model.Channel // public, open team, user not a member: in scope
	listed       *model.Channel // private, closed team, user not a member, listed: in scope
	publicClosed *model.Channel // public, closed team: out of scope
	memberPriv   *model.Channel // private, open team, user is a member: out of scope
	policy       *model.Channel // public, open team, policy enforced: out of scope
	dm           *model.Channel // the user's DM: out of scope

	posts map[string]*model.Post     // by channel ID
	files map[string]*model.FileInfo // by channel ID
}

const scopedSearchTerm = "scopedneedle"

func setupScopedSearchFixture(t *testing.T, th *SearchTestHelper) *scopedSearchFixture {
	t.Helper()
	f := &scopedSearchFixture{posts: map[string]*model.Post{}, files: map[string]*model.FileInfo{}}

	var err error
	f.openTeam, err = th.Store.Team().Save(&model.Team{Name: "scoped-open-" + model.NewId()[:8], DisplayName: "Scoped open", Type: model.TeamOpen, AllowOpenInvite: true})
	require.NoError(t, err)
	f.closedTeam, err = th.Store.Team().Save(&model.Team{Name: "scoped-closed-" + model.NewId()[:8], DisplayName: "Scoped closed", Type: model.TeamInvite})
	require.NoError(t, err)

	f.publicOpen, err = th.createChannel(f.openTeam.Id, "scoped-public-open", "Scoped public open", "", model.ChannelTypeOpen, nil, false)
	require.NoError(t, err)
	f.listed, err = th.createChannel(f.closedTeam.Id, "scoped-listed", "Scoped listed", "", model.ChannelTypePrivate, nil, false)
	require.NoError(t, err)
	f.publicClosed, err = th.createChannel(f.closedTeam.Id, "scoped-public-closed", "Scoped public closed", "", model.ChannelTypeOpen, nil, false)
	require.NoError(t, err)
	f.memberPriv, err = th.createChannel(f.openTeam.Id, "scoped-member-private", "Scoped member private", "", model.ChannelTypePrivate, th.User, false)
	require.NoError(t, err)
	f.policy, err = th.createChannel(f.openTeam.Id, "scoped-policy", "Scoped policy", "", model.ChannelTypeOpen, nil, false)
	require.NoError(t, err)
	_, err = th.Store.AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
		ID:      f.policy.Id,
		Name:    "Scoped policy",
		Type:    model.AccessControlPolicyTypeChannel,
		Active:  true,
		Version: model.AccessControlPolicyVersionV0_2,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.AccessControlPolicyActionMembership},
			Expression: `user.attributes.program == "engineering"`,
		}},
	})
	require.NoError(t, err)
	f.dm, err = th.createDirectChannel(f.openTeam.Id, "scoped dm", []*model.User{th.User, th.User2})
	require.NoError(t, err)

	for _, channel := range f.all() {
		post, err := th.createPost(th.User2.Id, channel.Id, scopedSearchTerm+" in "+channel.Name, "", model.PostTypeDefault, 0, false)
		require.NoError(t, err)
		f.posts[channel.Id] = post
		file, err := th.createFileInfo(th.User2.Id, post.Id, channel.Id, scopedSearchTerm+"-"+channel.Name, "", "txt", "text/plain", 0, 0)
		require.NoError(t, err)
		f.files[channel.Id] = file
	}

	t.Cleanup(func() {
		_ = th.deleteUserPosts(th.User2.Id)
		_ = th.deleteUserFileInfos(th.User2.Id)
		_ = th.Store.AccessControlPolicy().Delete(th.Context, f.policy.Id)
		_ = th.deleteChannels(f.all())
		_ = th.deleteTeam(f.openTeam)
		_ = th.deleteTeam(f.closedTeam)
	})
	return f
}

func (f *scopedSearchFixture) all() []*model.Channel {
	return []*model.Channel{f.publicOpen, f.listed, f.publicClosed, f.memberPriv, f.policy, f.dm}
}

func (f *scopedSearchFixture) cases() []struct {
	name      string
	teamID    string
	resources *model.SessionScopeResources
	want      []*model.Channel
} {
	full := &model.SessionScopeResources{ChannelIDs: []string{f.listed.Id}, OpenTeamPublicChannels: true}
	return []struct {
		name      string
		teamID    string
		resources *model.SessionScopeResources
		want      []*model.Channel
	}{
		{"all teams", "", full, []*model.Channel{f.publicOpen, f.listed}},
		{"open team", f.openTeam.Id, full, []*model.Channel{f.publicOpen}},
		{"closed team", f.closedTeam.Id, full, []*model.Channel{f.listed}},
		{"listed only", "", &model.SessionScopeResources{ChannelIDs: []string{f.listed.Id}}, []*model.Channel{f.listed}},
		{"listing a DM or a policy channel grants nothing", "", &model.SessionScopeResources{ChannelIDs: []string{f.dm.Id, f.policy.Id}}, nil},
		{"empty scope", "", &model.SessionScopeResources{}, nil},
	}
}

func testSearchPostsInSessionScope(t *testing.T, th *SearchTestHelper) {
	f := setupScopedSearchFixture(t, th)

	for _, tc := range f.cases() {
		t.Run(tc.name, func(t *testing.T) {
			params := &model.SearchParams{Terms: scopedSearchTerm, ScopedChannels: tc.resources}
			results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, tc.teamID, 0, 20)
			require.NoError(t, err)

			var want []string
			for _, channel := range tc.want {
				want = append(want, f.posts[channel.Id].Id)
			}
			var got []string
			for id := range results.Posts {
				got = append(got, id)
			}
			assert.ElementsMatch(t, want, got)
		})
	}

	t.Run("membership still applies without a scope", func(t *testing.T) {
		params := &model.SearchParams{Terms: scopedSearchTerm}
		results, err := th.Store.Post().SearchPostsForUser(th.Context, []*model.SearchParams{params}, th.User.Id, "", 0, 20)
		require.NoError(t, err)
		th.checkPostInSearchResults(t, f.posts[f.memberPriv.Id].Id, results.Posts)
		th.checkPostInSearchResults(t, f.posts[f.dm.Id].Id, results.Posts)
		assert.NotContains(t, results.Posts, f.posts[f.listed.Id].Id)
	})
}

func testSearchFilesInSessionScope(t *testing.T, th *SearchTestHelper) {
	f := setupScopedSearchFixture(t, th)

	for _, tc := range f.cases() {
		t.Run(tc.name, func(t *testing.T) {
			params := &model.SearchParams{Terms: scopedSearchTerm, ScopedChannels: tc.resources}
			results, err := th.Store.FileInfo().Search(th.Context, []*model.SearchParams{params}, th.User.Id, tc.teamID, 0, 20)
			require.NoError(t, err)

			var want []string
			for _, channel := range tc.want {
				want = append(want, f.files[channel.Id].Id)
			}
			var got []string
			for id := range results.FileInfos {
				got = append(got, id)
			}
			assert.ElementsMatch(t, want, got)
		})
	}
}
