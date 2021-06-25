package api

import (
	"encoding/json"

	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-toolkit/v4/logging"
)

type httpRecorderBase struct {
	client Client
	logger logging.LoggerInterface
}

// RecordRaw records raw data
func (h *httpRecorderBase) RecordRaw(url string, data []byte, metadata dtos.Metadata, extraHeaders map[string]string) error {
	return h.client.Post(url, data, AddMetadataToHeaders(metadata, extraHeaders, nil))
}

// HTTPImpressionRecorder is a struct responsible for submitting impression bulks to the backend
type HTTPImpressionRecorder struct {
	httpRecorderBase
}

// Record sends an array (or slice) of impressionsRecord to the backend
func (i *HTTPImpressionRecorder) Record(impressions []dtos.ImpressionsDTO, metadata dtos.Metadata, extraHeaders map[string]string) error {
	data, err := json.Marshal(impressions)
	if err != nil {
		i.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = i.RecordRaw("/testImpressions/bulk", data, metadata, extraHeaders)
	if err != nil {
		i.logger.Error("Error posting impressions", err.Error())
		return err
	}

	return nil
}

// RecordImpressionsCount sens impressionsCount
func (i *HTTPImpressionRecorder) RecordImpressionsCount(pf dtos.ImpressionsCountDTO, metadata dtos.Metadata) error {
	if len(pf.PerFeature) == 0 {
		return nil
	}
	data, err := json.Marshal(pf)
	if err != nil {
		i.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = i.RecordRaw("/testImpressions/count", data, metadata, nil)
	if err != nil {
		i.logger.Error("Error posting impressionsCount", err.Error())
		return err
	}

	return nil
}

// NewHTTPImpressionRecorder instantiates an HTTPImpressionRecorder
func NewHTTPImpressionRecorder(apikey string, cfg conf.AdvancedConfig, logger logging.LoggerInterface) service.ImpressionsRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.EventsURL, logger, dtos.Metadata{})
	return &HTTPImpressionRecorder{
		httpRecorderBase: httpRecorderBase{
			client: client,
			logger: logger,
		},
	}
}

// HTTPEventsRecorder is a struct responsible for submitting events bulks to the backend
type HTTPEventsRecorder struct {
	httpRecorderBase
}

// Record sends an array (or slice) of dtos.EventDTO to the backend
func (i *HTTPEventsRecorder) Record(events []dtos.EventDTO, metadata dtos.Metadata) error {
	data, err := json.Marshal(events)
	if err != nil {
		i.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = i.RecordRaw("/events/bulk", data, metadata, nil)
	if err != nil {
		i.logger.Error("Error posting events", err.Error())
		return err
	}

	return nil
}

// NewHTTPEventsRecorder instantiates an HTTPEventsRecorder
func NewHTTPEventsRecorder(apikey string, cfg conf.AdvancedConfig, logger logging.LoggerInterface) service.EventsRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.EventsURL, logger, dtos.Metadata{})
	return &HTTPEventsRecorder{
		httpRecorderBase: httpRecorderBase{
			client: client,
			logger: logger,
		},
	}
}

// HTTPTelemetryRecorder is a struct responsible for submitting telemetry to the backend
type HTTPTelemetryRecorder struct {
	httpRecorderBase
}

// NewHTTPTelemetryRecorder instantiates an HTTPTelemetryRecorder
func NewHTTPTelemetryRecorder(apikey string, cfg conf.AdvancedConfig, logger logging.LoggerInterface) service.TelemetryRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.TelemetryServiceURL, logger, dtos.Metadata{})
	return &HTTPTelemetryRecorder{
		httpRecorderBase: httpRecorderBase{
			client: client,
			logger: logger,
		},
	}
}

// RecordConfig method submits config
func (m *HTTPTelemetryRecorder) RecordConfig(config dtos.Config, metadata dtos.Metadata) error {
	data, err := json.Marshal(config)
	if err != nil {
		m.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = m.RecordRaw("/metrics/config", data, metadata, nil)
	if err != nil {
		m.logger.Error("Error posting config", err.Error())
		return err
	}

	return nil
}

// RecordStats method submits stats
func (m *HTTPTelemetryRecorder) RecordStats(stats dtos.Stats, metadata dtos.Metadata) error {
	data, err := json.Marshal(stats)
	if err != nil {
		m.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = m.RecordRaw("/metrics/usage", data, metadata, nil)
	if err != nil {
		m.logger.Error("Error posting usage", err.Error())
		return err
	}

	return nil
}
