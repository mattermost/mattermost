// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/model"

// getAddWikiPagePermissionsMigration grants wiki/page permissions at team scope.
// Channel roles intentionally hold none of these — wiki backing channels have no
// member-based permission resolution, and page perms are team-scoped (see
// plans/wiki-page-permissions-confluence.md).
func (a *App) getAddWikiPagePermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		// team_user: read/create/own-edit/own-delete + create_wiki + read_wiki
		permissionTransformation{
			On: isRole(model.TeamUserRoleId),
			Add: []string{
				model.PermissionReadWiki.Id,
				model.PermissionCreateWiki.Id,
				model.PermissionReadPage.Id,
				model.PermissionCreatePage.Id,
				model.PermissionEditOwnPage.Id,
				model.PermissionDeleteOwnPage.Id,
				model.PermissionCommentPage.Id,
			},
		},
		// team_admin: full wiki/page management
		permissionTransformation{
			On: isRole(model.TeamAdminRoleId),
			Add: []string{
				model.PermissionReadWiki.Id,
				model.PermissionCreateWiki.Id,
				model.PermissionManageWiki.Id,
				model.PermissionDeleteWiki.Id,
				model.PermissionAdminWiki.Id,
				model.PermissionReadPage.Id,
				model.PermissionCreatePage.Id,
				model.PermissionEditPage.Id,
				model.PermissionEditOwnPage.Id,
				model.PermissionDeleteOwnPage.Id,
				model.PermissionDeletePage.Id,
				model.PermissionCommentPage.Id,
			},
		},
		// system_guest: View + Comment, no create/edit/delete.
		// Mirrors Confluence's external-collaborator baseline within the spaces
		// they're granted to. Justification per perm:
		//   read_wiki, read_page  — guests must see what they're collaborating on.
		//   comment_page          — Confluence's distinctive guest capability;
		//                           comments are how external collaborators participate.
		// Excluded:
		//   create_wiki           — plan line 66: guests don't create spaces.
		//   create_page           — Confluence's default external-collab role is
		//                           read-only on content; v1 has no per-space role
		//                           tuning, so the safer default is omit.
		//   edit_own_page /
		//   delete_own_page       — pointless without create_page (no own pages
		//                           can exist).
		permissionTransformation{
			On: isRole(model.SystemGuestRoleId),
			Add: []string{
				model.PermissionReadWiki.Id,
				model.PermissionReadPage.Id,
				model.PermissionCommentPage.Id,
			},
		},
		// system_admin: all wiki/page permissions
		permissionTransformation{
			On: isRole(model.SystemAdminRoleId),
			Add: []string{
				model.PermissionReadWiki.Id,
				model.PermissionCreateWiki.Id,
				model.PermissionManageWiki.Id,
				model.PermissionDeleteWiki.Id,
				model.PermissionAdminWiki.Id,
				model.PermissionReadPage.Id,
				model.PermissionCreatePage.Id,
				model.PermissionEditPage.Id,
				model.PermissionEditOwnPage.Id,
				model.PermissionDeleteOwnPage.Id,
				model.PermissionDeletePage.Id,
				model.PermissionCommentPage.Id,
			},
		},
	}, nil
}
