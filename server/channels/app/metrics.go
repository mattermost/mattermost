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
			a.Metrics().IncrementClientLongTasks(commonLabels["platform"], commonLabels["agent"], c.Value)
		default:
			// we intentionally skip unknown metrics
		}
	}

	for _, h := range report.Histograms {
		switch h.Metric {
		case model.ClientTimeToFirstByte:
			a.Metrics().ObserveClientTimeToFirstByte(commonLabels["platform"], commonLabels["agent"], h.Value/1000)
		case model.ClientFirstContentfulPaint:
			a.Metrics().ObserveClientFirstContentfulPaint(commonLabels["platform"], commonLabels["agent"], h.Value/1000)
		case model.ClientLargestContentfulPaint:
			a.Metrics().ObserveClientLargestContentfulPaint(
				commonLabels["platform"],
				commonLabels["agent"],
				h.GetLabelValue("region", model.AcceptedLCPRegions, "other"),
				h.Value/1000,
			)
		case model.ClientInteractionToNextPaint:
			a.Metrics().ObserveClientInteractionToNextPaint(
				commonLabels["platform"],
				commonLabels["agent"],
				h.GetLabelValue("interaction", model.AcceptedInteractions, "other"),
				h.Value/1000,
			)
		case model.ClientCumulativeLayoutShift:
			a.Metrics().ObserveClientCumulativeLayoutShift(commonLabels["platform"], commonLabels["agent"], h.Value)
		case model.ClientPageLoadDuration:
			a.Metrics().ObserveClientPageLoadDuration(commonLabels["platform"], commonLabels["agent"], h.Value/1000)
		case model.ClientChannelSwitchDuration:
			a.Metrics().ObserveClientChannelSwitchDuration(
				commonLabels["platform"],
				commonLabels["agent"],
				h.GetLabelValue("fresh", model.AcceptedTrueFalseLabels, ""),
				h.Value/1000,
			)
		case model.ClientTeamSwitchDuration:
			a.Metrics().ObserveClientTeamSwitchDuration(
				commonLabels["platform"],
				commonLabels["agent"],
				h.GetLabelValue("fresh", model.AcceptedTrueFalseLabels, ""),
				h.Value/1000,
			)
		case model.ClientRHSLoadDuration:
			a.Metrics().ObserveClientRHSLoadDuration(commonLabels["platform"], commonLabels["agent"], h.Value/1000)
		case model.ClientGlobalThreadsLoadDuration:
			a.Metrics().ObserveGlobalThreadsLoadDuration(commonLabels["platform"], commonLabels["agent"], h.Value/1000)
		case model.MobileClientLoadDuration:
			a.Metrics().ObserveMobileClientLoadDuration(commonLabels["platform"], h.Value/1000)
		case model.MobileClientChannelSwitchDuration:
			a.Metrics().ObserveMobileClientChannelSwitchDuration(commonLabels["platform"], h.Value/1000)
		case model.MobileClientTeamSwitchDuration:
			a.Metrics().ObserveMobileClientTeamSwitchDuration(commonLabels["platform"], h.Value/1000)
		default:
			// we intentionally skip unknown metrics
		}
	}

	return nil
}
