// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ExportDataDir is the name of the directory were to store additional data
// included with the export (e.g. file attachments).
const ExportDataDir = "data"

type BulkExportOpts struct {
	IncludeAttachments      bool
	IncludeProfilePictures  bool
	IncludeArchivedChannels bool
	IncludeRolesAndSchemes  bool
	CreateArchive           bool
	TeamName                string
	ChannelName             string

	// IncludeCustomEmoji forces the source instance's custom emoji into a scoped
	// (team- or channel-filtered) export. Emoji are instance-global, so a scoped
	// export omits them by default instead of carrying the whole emoji library.
	// Ignored for full-instance exports, which always include custom emoji.
	IncludeCustomEmoji bool
}

// ImportedUsersPosture is the access posture a scoped import gives to the accounts
// it creates. It is deliberately a tri-state rather than a bool: there is no safe
// default, so "not stated" has to be distinguishable from either choice.
//
// On a new instance the users are moving to, "inactive" locks out the entire
// population, and SSO users have no self-service path back in. On an instance that
// already holds other people's content, "active" grants access to accounts created
// from weak identity matches. The server cannot tell the two destinations apart, so
// a scoped import requires the operator to say which one this is.
//
// A delete_at supplied by the source is preserved under both values; someone
// revoked at the source is never re-enabled by a migration.
type ImportedUsersPosture string

const (
	// ImportedUsersUnset means the operator did not state a choice. A scoped import
	// fails at the version line; a full-instance import ignores it, since it creates
	// no accounts under this policy.
	ImportedUsersUnset ImportedUsersPosture = ""

	// ImportedUsersActive leaves created accounts able to sign in.
	ImportedUsersActive ImportedUsersPosture = "active"

	// ImportedUsersInactive deactivates created accounts and tags them with
	// model.UserPropsKeyImportedInactive pending administrator review.
	ImportedUsersInactive ImportedUsersPosture = "inactive"
)

// IsValid reports whether p is one of the two stated choices. ImportedUsersUnset is
// not valid: callers that require a choice must reject it, and callers that don't
// require one must not call this.
func (p ImportedUsersPosture) IsValid() bool {
	return p == ImportedUsersActive || p == ImportedUsersInactive
}

type BulkImportOpts struct {
	// DestinationTeamName remaps the source team name to a different team name on
	// the destination server.
	DestinationTeamName string

	// DestinationChannelName remaps the source channel name to a different channel
	// name on the destination server. Only valid for channel-scoped exports.
	DestinationChannelName string

	// SkipPreflight bypasses SSO provider configuration checks. By default the
	// import fails if the export contains users from an auth provider that is
	// not enabled on the destination, to prevent silent deactivated shells.
	// Set this to true only after reviewing the preflight error and accepting
	// the risk of proceeding with a mismatched configuration.
	SkipPreflight bool

	// ImportedUsers is the access posture for accounts the import creates. Required
	// for a scoped (team- or channel-filtered) archive, which fails at the version
	// line when it is ImportedUsersUnset. Ignored for a full-instance import.
	ImportedUsers ImportedUsersPosture

	// ResumeFromLine skips post and direct_post lines up to and including this
	// line number, re-processing all other segment types (roles, teams, channels,
	// users, bots) from the start to restore consistent state. 0 means no resume.
	ResumeFromLine int

	// OnCheckpoint is called after each segment boundary completes (i.e. after
	// wg.Wait() drains all workers for that segment type). The argument is the
	// last line number fully processed. Callers use this to persist a checkpoint
	// so a failed import can be resumed without restarting from line 1. A negative
	// argument reports the total line count for progress display and must be
	// handled separately from positive resume checkpoints.
	// Nil means no checkpointing.
	OnCheckpoint func(lineNumber int)
}
