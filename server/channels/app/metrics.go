// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) RegisterPerformanceReport(rctx request.CTX, report *model.PerformanceReport) *model.AppError {
	if a.Metrics() == nil {
		return nil
	}

	commonLabels := report.ProcessLabels()

	for _, c := range report.Counters {
		switch c.Metric {
		case model.ClientMetricChannelVisited:
			a.Metrics().IncrementClientChannelVisited(commonLabels["platform"], commonLabels["agent"], float64(c.Value))
		default:
			// we intentionally skip unknown metrics
		}
	}

	for _, h := range report.Histograms {
		switch h.Metric {
		case model.ClientMetricChannelLoad:
			a.Metrics().ObserveClientChannelLoadTime(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		default:
			// we intentionally skip unknown metrics
		}
	}

	return nil
}
