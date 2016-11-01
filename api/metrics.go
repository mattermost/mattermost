// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	// "log"
	// "os"
	"time"

	"github.com/deathowl/go-metrics-prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rcrowley/go-metrics"
)

var Met *Metrics

type Metrics struct {
	Registry                  metrics.Registry
	TotalWebSocketConnections metrics.Gauge
	TotalMasterDbConnections  metrics.Gauge
	TotalReadDbConnections    metrics.Gauge
}

func InitializeMetrics() {
	if Met == nil {
		Met = &Metrics{}
		Met.Registry = metrics.DefaultRegistry

		Met.TotalWebSocketConnections = metrics.NewFunctionalGauge(func() int64 { return int64(TotalWebsocketConnections()) })
		metrics.Register("TotalWebSocketConnections", Met.TotalWebSocketConnections)

		Met.TotalMasterDbConnections = metrics.NewFunctionalGauge(func() int64 { return int64(Srv.Store.TotalMasterDbConnections()) })
		metrics.Register("TotalMasterDbConnections", Met.TotalMasterDbConnections)

		Met.TotalReadDbConnections = metrics.NewFunctionalGauge(func() int64 { return int64(Srv.Store.TotalReadDbConnections()) })
		metrics.Register("TotalReadDbConnections", Met.TotalReadDbConnections)

		prometheusRegistry := prometheus.NewRegistry()

		pClient := prometheusmetrics.NewPrometheusProvider(Met.Registry, "test", "subsys", prometheusRegistry, 5*time.Second)
		go pClient.UpdatePrometheusMetrics()
		//go metrics.Log(Met.Registry, 5*time.Second, log.New(os.Stderr, "metrics: ", log.Lmicroseconds))
	}
}
