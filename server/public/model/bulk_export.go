// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ExportDataDir is the name of the directory were to store additional data
// included with the export (e.g. file attachments).
const ExportDataDir = "data"

type BulkExportOpts struct {
	IncludeAttachments      bool
	IncludeArchivedChannels bool
	CreateArchive           bool
}
