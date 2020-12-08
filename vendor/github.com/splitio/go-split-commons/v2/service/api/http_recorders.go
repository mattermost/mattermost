package api

import (
	"encoding/json"

	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
)

type httpRecorderBase struct {
	client Client
	logger logging.LoggerInterface
}

// RecordRaw records raw data
func (h *httpRecorderBase) RecordRaw(url string, data []byte, metadata dtos.Metadata, extraHeaders map[string]string) error {
	headers := make(map[string]string)
	headers["SplitSDKVersion"] = metadata.SDKVersion
	if metadata.MachineName != "NA" && metadata.MachineName != "unknown" {
		headers["SplitSDKMachineName"] = metadata.MachineName
	}
	if metadata.MachineIP != "NA" && metadata.MachineIP != "unknown" {
		headers["SplitSDKMachineIP"] = metadata.MachineIP
	}
	if extraHeaders != nil {
		for header, value := range extraHeaders {
			headers[header] = value
		}
	}
	return h.client.Post(url, data, headers)
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
func NewHTTPImpressionRecorder(
	apikey string,
	cfg conf.AdvancedConfig,
	logger logging.LoggerInterface,
) *HTTPImpressionRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.EventsURL, logger, dtos.Metadata{})
	return &HTTPImpressionRecorder{
		httpRecorderBase: httpRecorderBase{
			client: client,
			logger: logger,
		},
	}
}

// HTTPMetricsRecorder is a struct responsible for submitting metrics (latency, gauge, counters) to the backend
type HTTPMetricsRecorder struct {
	httpRecorderBase
}

// RecordCounters method submits counter metrics to the backend
func (m *HTTPMetricsRecorder) RecordCounters(counters []dtos.CounterDTO, metadata dtos.Metadata) error {
	data, err := json.Marshal(counters)
	if err != nil {
		m.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = m.RecordRaw("/metrics/counters", data, metadata, nil)
	if err != nil {
		m.logger.Error("Error posting counters", err.Error())
		return err
	}

	return nil
}

// RecordLatencies method submits latency metrics to the backend
func (m *HTTPMetricsRecorder) RecordLatencies(latencies []dtos.LatenciesDTO, metadata dtos.Metadata) error {
	data, err := json.Marshal(latencies)
	if err != nil {
		m.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = m.RecordRaw("/metrics/times", data, metadata, nil)
	if err != nil {
		m.logger.Error("Error posting latencies", err.Error())
		return err
	}

	return nil
}

// RecordGauge method submits gauge metrics to the backend
func (m *HTTPMetricsRecorder) RecordGauge(gauge dtos.GaugeDTO, metadata dtos.Metadata) error {
	data, err := json.Marshal(gauge)
	if err != nil {
		m.logger.Error("Error marshaling JSON", err.Error())
		return err
	}

	err = m.RecordRaw("/metrics/gauge", data, metadata, nil)
	if err != nil {
		m.logger.Error("Error posting gauges", err.Error())
		return err
	}

	return nil
}

// NewHTTPMetricsRecorder instantiates an HTTPMetricsRecorder
func NewHTTPMetricsRecorder(
	apikey string,
	cfg conf.AdvancedConfig,
	logger logging.LoggerInterface,
) *HTTPMetricsRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.EventsURL, logger, dtos.Metadata{})
	return &HTTPMetricsRecorder{
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
func NewHTTPEventsRecorder(
	apikey string,
	cfg conf.AdvancedConfig,
	logger logging.LoggerInterface,
) *HTTPEventsRecorder {
	client := NewHTTPClient(apikey, cfg, cfg.EventsURL, logger, dtos.Metadata{})
	return &HTTPEventsRecorder{
		httpRecorderBase: httpRecorderBase{
			client: client,
			logger: logger,
		},
	}
}
