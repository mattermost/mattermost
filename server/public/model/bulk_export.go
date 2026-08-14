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
}
