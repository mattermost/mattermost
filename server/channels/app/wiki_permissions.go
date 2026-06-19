// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/model"

// SessionHasWikiPermission resolves a wiki-scoped permission for a session.
// Grants come from the team role; the wiki creator additionally retains
// management perms (manage_wiki / admin_wiki / delete_wiki) regardless of
// team-role grants — Confluence's "creator admins their space" semantics
// without per-wiki state.
//
// See plans/wiki-page-permissions-confluence.md.
func (a *App) SessionHasWikiPermission(session model.Session, wiki *model.Wiki, perm *model.Permission) bool {
	if wiki == nil || perm == nil {
		return false
	}
	if a.SessionHasPermissionToTeam(session, wiki.TeamId, perm) {
		return true
	}
	if isWikiManagementPerm(perm) && a.IsWikiOwner(session, wiki) {
		return true
	}
	return false
}

func isWikiManagementPerm(perm *model.Permission) bool {
	switch perm.Id {
	case model.PermissionManageWiki.Id,
		model.PermissionAdminWiki.Id,
		model.PermissionDeleteWiki.Id:
		return true
	}
	return false
}

// SessionHasPagePermission resolves a page-scoped permission for a session.
// Delegates to SessionHasWikiPermission. The _own_ variants (edit_own_page,
// delete_own_page) additionally require page authorship.
func (a *App) SessionHasPagePermission(session model.Session, wiki *model.Wiki, page *model.Page, perm *model.Permission) bool {
	if perm == nil {
		return false
	}
	switch perm.Id {
	case model.PermissionEditOwnPage.Id, model.PermissionDeleteOwnPage.Id:
		if page == nil || page.UserId != session.UserId {
			return false
		}
	}
	return a.SessionHasWikiPermission(session, wiki, perm)
}

// IsWikiOwner grants Confluence's "creator admins their space" semantics without
// per-wiki state. The team-viewer check ensures a former team member loses the
// ownership shortcut on team removal, and also ensures the session is not
// restricted in a way that blocks access.
func (a *App) IsWikiOwner(session model.Session, wiki *model.Wiki) bool {
	if wiki == nil || wiki.CreatorId == "" {
		return false
	}
	if wiki.CreatorId != session.UserId {
		return false
	}
	if wiki.TeamId == "" {
		return true
	}
	return a.SessionHasPermissionToTeam(session, wiki.TeamId, model.PermissionViewTeam)
}
