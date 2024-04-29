// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) RegisterPerformanceReport(rctx request.CTX, report *model.PerformanceReport) *model.AppError {
	if a.Metrics() == nil {
		return nil
	}

	for _, c := range report.Counters {
		switch c.Metric {
		case model.ClientMetricChannelVisited:
			a.Metrics().IncrementClientChannelVisited(report.Labels["platform"], report.Labels["agent"], float64(c.Value))
		default:
			return model.NewAppError("RegisterPerformanceReport", "", nil, "", http.StatusNotFound)
		}
	}

	for _, h := range report.Histograms {
		switch h.Metric {
		case model.ClientMetricChannelLoad:
			a.Metrics().ObserveClientChannelLoadTime(report.Labels["platform"], report.Labels["agent"], float64(h.Value))
		default:
			return model.NewAppError("RegisterPerformanceReport", "", nil, "", http.StatusNotFound)
		}
	}

	return nil
}
