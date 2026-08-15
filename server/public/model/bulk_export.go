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
}

type BulkImportOpts struct {
	// DestinationTeam remaps the source team name to a different team name on
	// the destination server.
	DestinationTeam string

	// SkipPreflight bypasses SSO provider configuration checks. By default the
	// import fails if the export contains users from an auth provider that is
	// not enabled on the destination, to prevent silent deactivated shells.
	// Set this to true only after reviewing the preflight error and accepting
	// the risk of proceeding with a mismatched configuration.
	SkipPreflight bool

	// ResumeFromLine skips post and direct_post lines up to and including this
	// line number, re-processing all other segment types (roles, teams, channels,
	// users, bots) from the start to restore consistent state. 0 means no resume.
	ResumeFromLine int

	// OnCheckpoint is called after each segment boundary completes (i.e. after
	// wg.Wait() drains all workers for that segment type). The argument is the
	// last line number fully processed. Callers use this to persist a checkpoint
	// so a failed import can be resumed without restarting from line 1.
	// Nil means no checkpointing.
	OnCheckpoint func(lineNumber int)
}
