// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSessionHasWikiPermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		Id:        model.NewId(),
		TeamId:    th.BasicTeam.Id,
		CreatorId: th.BasicUser.Id,
		Title:     "Perm Test Wiki",
	}

	teamUserSession := model.Session{
		UserId: th.BasicUser.Id,
		TeamMembers: []*model.TeamMember{
			{UserId: th.BasicUser.Id, TeamId: th.BasicTeam.Id, Roles: model.TeamUserRoleId},
		},
	}

	t.Run("nil wiki returns false", func(t *testing.T) {
		assert.False(t, th.App.SessionHasWikiPermission(teamUserSession, nil, model.PermissionReadWiki))
	})

	t.Run("nil permission returns false", func(t *testing.T) {
		assert.False(t, th.App.SessionHasWikiPermission(teamUserSession, wiki, nil))
	})

	t.Run("system admin always granted", func(t *testing.T) {
		adminSession := model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemAdminRoleId,
		}
		assert.True(t, th.App.SessionHasWikiPermission(adminSession, wiki, model.PermissionManageWiki))
		assert.True(t, th.App.SessionHasWikiPermission(adminSession, wiki, model.PermissionDeleteWiki))
	})

	t.Run("creator override grants management perms even without team-role grant", func(t *testing.T) {
		// team_user role does not include manage_wiki / delete_wiki / admin_wiki by default, so
		// success here can only be explained by the creator-override branch.
		assert.True(t, th.App.SessionHasWikiPermission(teamUserSession, wiki, model.PermissionManageWiki))
		assert.True(t, th.App.SessionHasWikiPermission(teamUserSession, wiki, model.PermissionDeleteWiki))
		assert.True(t, th.App.SessionHasWikiPermission(teamUserSession, wiki, model.PermissionAdminWiki))
	})

	t.Run("creator override does NOT extend to non-management perms", func(t *testing.T) {
		// PermissionReadWiki / PermissionCreateWiki are NOT in isWikiManagementPerm, so they fall
		// through to the team-role grant path. With no team_user permission grant configured, denied.
		nonCreatorSession := model.Session{
			UserId: th.BasicUser2.Id,
			TeamMembers: []*model.TeamMember{
				{UserId: th.BasicUser2.Id, TeamId: th.BasicTeam.Id, Roles: model.TeamUserRoleId},
			},
		}
		// Non-creator without team-role grant for manage perms: denied (no override).
		assert.False(t, th.App.SessionHasWikiPermission(nonCreatorSession, wiki, model.PermissionManageWiki))
		assert.False(t, th.App.SessionHasWikiPermission(nonCreatorSession, wiki, model.PermissionDeleteWiki))
	})

	t.Run("non-team-member is denied", func(t *testing.T) {
		strangerSession := model.Session{
			UserId: model.NewId(),
		}
		assert.False(t, th.App.SessionHasWikiPermission(strangerSession, wiki, model.PermissionReadWiki))
	})
}

func TestSessionHasPagePermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		Id:        model.NewId(),
		TeamId:    th.BasicTeam.Id,
		CreatorId: th.BasicUser.Id,
	}

	authorPage := &model.Post{Id: model.NewId(), UserId: th.BasicUser.Id}
	otherPage := &model.Post{Id: model.NewId(), UserId: th.BasicUser2.Id}

	authorSession := model.Session{
		UserId: th.BasicUser.Id,
		TeamMembers: []*model.TeamMember{
			{UserId: th.BasicUser.Id, TeamId: th.BasicTeam.Id, Roles: model.TeamUserRoleId},
		},
	}

	t.Run("nil permission returns false", func(t *testing.T) {
		assert.False(t, th.App.SessionHasPagePermission(authorSession, wiki, authorPage, nil))
	})

	t.Run("edit_own_page on authored page falls through to wiki perm check", func(t *testing.T) {
		// Author + creator-of-wiki: management-perm path doesn't apply (edit_own_page is not a
		// wiki-management perm). Grant team_user the perm and verify success.
		th.AddPermissionToRole(t, model.PermissionEditOwnPage.Id, model.TeamUserRoleId)
		assert.True(t, th.App.SessionHasPagePermission(authorSession, wiki, authorPage, model.PermissionEditOwnPage))
	})

	t.Run("edit_own_page on someone else's page is denied", func(t *testing.T) {
		th.AddPermissionToRole(t, model.PermissionEditOwnPage.Id, model.TeamUserRoleId)
		assert.False(t, th.App.SessionHasPagePermission(authorSession, wiki, otherPage, model.PermissionEditOwnPage))
	})

	t.Run("delete_own_page on nil page is denied", func(t *testing.T) {
		assert.False(t, th.App.SessionHasPagePermission(authorSession, wiki, nil, model.PermissionDeleteOwnPage))
	})

	t.Run("non-own perm does not require authorship", func(t *testing.T) {
		// edit_page (not edit_own_page) skips the authorship check; falls through to wiki perm.
		th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.TeamUserRoleId)
		assert.True(t, th.App.SessionHasPagePermission(authorSession, wiki, otherPage, model.PermissionEditPage))
	})
}

// TestSessionHasWikiPermission_CreatorBypassIrrevocable documents issue #6:
// the IsWikiOwner shortcut grants manage_wiki / admin_wiki / delete_wiki to any
// wiki creator who still holds PermissionViewTeam (the default for all team members).
// An admin cannot revoke this without removing the creator from the team entirely.
//
// EXPECTED after fix #6: manage_wiki should require an explicit, revocable ACL entry
// on the wiki — not implicit ownership combined with ViewTeam.
// FAILS with current code because IsWikiOwner returns true for creator + ViewTeam.
func TestSessionHasWikiPermission_CreatorBypassIrrevocable(t *testing.T) {
	t.Skip("Bug #6 not yet fixed")
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Wiki created by basicUser — they are the "owner" under the current model.
	wiki := &model.Wiki{
		Id:        model.NewId(),
		TeamId:    th.BasicTeam.Id,
		CreatorId: th.BasicUser.Id,
	}

	// Session has only ViewTeam (team_user role); no manage_wiki grant from any role.
	// This is the situation after an admin has explicitly NOT granted manage_wiki
	// to the creator's team role — the creator should have no management rights.
	creatorSession := model.Session{
		UserId: th.BasicUser.Id,
		TeamMembers: []*model.TeamMember{
			{UserId: th.BasicUser.Id, TeamId: th.BasicTeam.Id, Roles: model.TeamUserRoleId},
		},
	}

	// BUG #6: returns true because IsWikiOwner grants manage_wiki via ViewTeam alone.
	// After the fix, this should be false — ownership must be backed by an explicit ACL.
	assert.False(t, th.App.SessionHasWikiPermission(creatorSession, wiki, model.PermissionManageWiki),
		"BUG #6: creator retains manage_wiki irrevocably while they have ViewTeam; "+
			"fix by replacing IsWikiOwner shortcut with an explicit, revocable wiki-ACL record")
	assert.False(t, th.App.SessionHasWikiPermission(creatorSession, wiki, model.PermissionDeleteWiki),
		"BUG #6: same irrevocable bypass applies to delete_wiki")
}

func TestIsWikiOwner(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	wiki := &model.Wiki{
		Id:        model.NewId(),
		TeamId:    th.BasicTeam.Id,
		CreatorId: th.BasicUser.Id,
	}

	t.Run("nil wiki returns false", func(t *testing.T) {
		session := model.Session{UserId: th.BasicUser.Id}
		assert.False(t, th.App.IsWikiOwner(session, nil))
	})

	t.Run("wiki with no creator returns false", func(t *testing.T) {
		session := model.Session{UserId: th.BasicUser.Id}
		w := &model.Wiki{Id: model.NewId(), TeamId: th.BasicTeam.Id}
		assert.False(t, th.App.IsWikiOwner(session, w))
	})

	t.Run("non-creator session returns false", func(t *testing.T) {
		session := model.Session{UserId: th.BasicUser2.Id}
		assert.False(t, th.App.IsWikiOwner(session, wiki))
	})

	t.Run("creator with team membership returns true", func(t *testing.T) {
		session := model.Session{
			UserId: th.BasicUser.Id,
			TeamMembers: []*model.TeamMember{
				{UserId: th.BasicUser.Id, TeamId: th.BasicTeam.Id, Roles: model.TeamUserRoleId},
			},
		}
		assert.True(t, th.App.IsWikiOwner(session, wiki))
	})

	t.Run("creator with no team-id wiki returns true", func(t *testing.T) {
		session := model.Session{UserId: th.BasicUser.Id}
		w := &model.Wiki{Id: model.NewId(), CreatorId: th.BasicUser.Id, TeamId: ""}
		assert.True(t, th.App.IsWikiOwner(session, w))
	})

	t.Run("former team member loses creator override", func(t *testing.T) {
		// Session with no team membership for the wiki's team should fail the view-team check.
		session := model.Session{UserId: th.BasicUser.Id}
		assert.False(t, th.App.IsWikiOwner(session, wiki))
	})
}
