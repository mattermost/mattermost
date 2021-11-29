// Copyright 2013 The imageproxy authors.
// SPDX-License-Identifier: Apache-2.0

package imageproxy

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	metricServedFromCache = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: "imageproxy",
			Name:      "requests_served_from_cache_total",
			Help:      "Number of requests served from cache.",
		})
	metricTransformationDuration = prometheus.NewSummary(prometheus.SummaryOpts{
		Namespace: "imageproxy",
		Name:      "transformation_duration_seconds",
		Help:      "Time taken for image transformations in seconds.",
	})
	metricRemoteErrors = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "imageproxy",
		Name:      "remote_fetch_errors_total",
		Help:      "Total remote image fetch errors",
	})
	metricRequestDuration = prometheus.NewSummary(prometheus.SummaryOpts{
		Namespace: "http",
		Name:      "request_duration_seconds",
		Help:      "Request response times",
	})
)

func init() {
	prometheus.MustRegister(metricTransformationDuration)
	prometheus.MustRegister(metricServedFromCache)
	prometheus.MustRegister(metricRemoteErrors)
	prometheus.MustRegister(metricRequestDuration)
}
