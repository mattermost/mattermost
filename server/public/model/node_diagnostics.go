// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type SectionErrors map[NodeSection]error

type NodeDiagnostics struct {
	Diagnostics *SupportPacketDiagnostics
	Errors      SectionErrors
}
