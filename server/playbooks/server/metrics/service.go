package metrics

import (
	"net/http"
	"time"

	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// Service prometheus to run the server.
type Service struct {
	*http.Server
}

type ErrorLoggerWrapper struct {
}

func (el *ErrorLoggerWrapper) Println(v ...interface{}) {
	logrus.Warn("metric server error", v)
}

// NewMetricsServer factory method to create a new prometheus server.
func NewMetricsServer(address string, metricsService *Metrics) *Service {
	return &Service{
		&http.Server{
			ReadTimeout: 30 * time.Second,
			Addr:        address,
			Handler: promhttp.HandlerFor(metricsService.registry, promhttp.HandlerOpts{
				ErrorLog: &ErrorLoggerWrapper{},
			}),
		},
	}
}

// Run will start the prometheus server.
func (h *Service) Run() error {
	return errors.Wrap(h.Server.ListenAndServe(), "prometheus ListenAndServe")
}

// Shutdown will shutdown the prometheus server.
func (h *Service) Shutdown() error {
	return errors.Wrap(h.Server.Close(), "prometheus Close")
}
