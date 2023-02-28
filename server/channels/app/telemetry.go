// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v6/platform/services/telemetry"

func (s *Server) GetTelemetryService() *telemetry.TelemetryService {
	return s.telemetryService
}
