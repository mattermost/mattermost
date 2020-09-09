// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"

	"github.com/mattermost/mattermost-server/v5/services/importexport"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) BulkImport(fileReader io.Reader, dryRun bool, workers int) (*model.AppError, int) {
	importer := importexport.NewImporter(a, a.Srv().Store, a.Config())
	return importer.BulkImport(fileReader, dryRun, workers)
}

func (a *App) BulkExport(writer io.Writer, file string, pathToEmojiDir string, dirNameToExportEmoji string) *model.AppError {
	exporter := importexport.NewExporter(a, a.Srv().Store)
	return exporter.BulkExport(writer, file, pathToEmojiDir, dirNameToExportEmoji)
}
