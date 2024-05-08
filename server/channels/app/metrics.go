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
		case model.ClientLongTasks:
			a.Metrics().IncrementClientLongTasks(commonLabels["platform"], commonLabels["agent"], float64(c.Value))
		default:
			// we intentionally skip unknown metrics
		}
	}

	for _, h := range report.Histograms {
		switch h.Metric {
		case model.ClientTimeToFirstByte:
			a.Metrics().ObserveClientTimeToFirstByte(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientFirstContentfulPaint:
			a.Metrics().ObserveClientFirstContentfulPaint(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientLargestContentfulPaint:
			a.Metrics().ObserveClientLargestContentfulPaint(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientInteractionToNextPaint:
			a.Metrics().ObserveClientInteractionToNextPaint(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientCumulativeLayoutShift:
			a.Metrics().ObserveClientCumulativeLayoutShift(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientChannelSwitchDuration:
			a.Metrics().ObserveClientChannelSwitchDuration(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientTeamSwitchDuration:
			a.Metrics().ObserveClientTeamSwitchDuration(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		case model.ClientRHSLoadDuration:
			a.Metrics().ObserveClientRHSLoadDuration(commonLabels["platform"], commonLabels["agent"], float64(h.Value))
		default:
			// we intentionally skip unknown metrics
		}
	}

	return nil
}
