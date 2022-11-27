// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"archive/zip"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
)

type ComplianceInterface interface {
	StartComplianceDailyJob()
	RunComplianceJob(job *model.Compliance) *model.AppError
}

type ComplianceExporterProduct interface {
	Exporter(cursor map[string]any, limit int) (ComplianceExporter, map[string]any, error)
}

type ComplianceExporter interface {
	ExportedEntitiesCount() int
	CsvExport(zipFile *zip.Writer, fileBackend filestore.FileBackend) error
}
