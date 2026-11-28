// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// Auditor interface for creating audit records
type Auditor interface {
	MakeAuditRecord(event string, initialStatus string) *model.AuditRecord
	LogAuditRec(auditRec *model.AuditRecord)
}
