// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package validation

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/mattermost/mattermost/server/public/model"
)

// MetricSampleRequest represents a single metric measurement in the request
type MetricSampleRequest struct {
	Metric    string            `json:"metric" validate:"required"`
	Value     float64           `json:"value" validate:"required"`
	Timestamp float64           `json:"timestamp,omitempty" validate:"omitempty,gte=0"`
	Labels    map[string]string `json:"labels,omitempty" validate:"omitempty,dive,keys,required"`
}

// PerformanceReportRequest represents the request body for submitting a performance report
type PerformanceReportRequest struct {
	Version       string                 `json:"version" validate:"required"`
	ClientID      string                 `json:"client_id"`
	Labels        map[string]string      `json:"labels"`
	Start         float64                `json:"start" validate:"required,gt=0"`
	End           float64                `json:"end" validate:"required,gt=0,gtfield=Start"`
	Counters      []*MetricSampleRequest `json:"counters" validate:"dive"`
	Histograms    []*MetricSampleRequest `json:"histograms" validate:"dive"`
	ClientVersion string                 `json:"client_version" validate:"required"`
	ClientHash    string                 `json:"client_hash" validate:"required"`
}

// ValidatePerformanceReport validates the performance report request
func ValidatePerformanceReport(r *http.Request) *model.AppError {
	var req PerformanceReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	validate := validator.New()
	if err := validate.Struct(req); err != nil {
		return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// Validate labels
	if req.Labels != nil {
		for key := range req.Labels {
			if key == "" {
				return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, "empty label key", http.StatusBadRequest)
			}
		}
	}

	// Validate metric samples
	validateSamples := func(samples []*MetricSampleRequest) error {
		if samples == nil {
			return nil
		}
		for _, sample := range samples {
			if sample.Labels != nil {
				for key := range sample.Labels {
					if key == "" {
						return fmt.Errorf("empty label key")
					}
				}
			}
			if sample.Timestamp < 0 {
				return fmt.Errorf("invalid timestamp: %f", sample.Timestamp)
			}
		}
		return nil
	}

	if err := validateSamples(req.Counters); err != nil {
		return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err := validateSamples(req.Histograms); err != nil {
		return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	// Convert request to model.PerformanceReport for additional validation
	report := &model.PerformanceReport{
		Version:    req.Version,
		ClientID:   req.ClientID,
		Labels:     req.Labels,
		Start:      req.Start,
		End:        req.End,
		Counters:   convertMetricSamples(req.Counters),
		Histograms: convertMetricSamples(req.Histograms),
	}

	// Validate the performance report itself
	if err := report.IsValid(); err != nil {
		return model.NewAppError("SubmitPerformanceReport", "api.metrics.submit_performance_report.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return nil
}

// convertMetricSamples converts request metric samples to model metric samples
func convertMetricSamples(samples []*MetricSampleRequest) []*model.MetricSample {
	if samples == nil {
		return nil
	}

	result := make([]*model.MetricSample, len(samples))
	for i, sample := range samples {
		result[i] = &model.MetricSample{
			Metric:    model.MetricType(sample.Metric),
			Value:     sample.Value,
			Timestamp: sample.Timestamp,
			Labels:    sample.Labels,
		}
	}
	return result
}
