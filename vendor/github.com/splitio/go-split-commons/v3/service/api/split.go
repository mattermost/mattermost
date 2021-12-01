package api

import (
	"github.com/splitio/go-split-commons/v3/conf"
	"github.com/splitio/go-split-commons/v3/dtos"
	"github.com/splitio/go-split-commons/v3/service"
	"github.com/splitio/go-toolkit/v4/logging"
)

// SplitAPI struct for fetchers and recorders
type SplitAPI struct {
	AuthClient         service.AuthClient
	SplitFetcher       service.SplitFetcher
	SegmentFetcher     service.SegmentFetcher
	ImpressionRecorder service.ImpressionsRecorder
	EventRecorder      service.EventsRecorder
	TelemetryRecorder  service.TelemetryRecorder
}

// NewSplitAPI creates new splitAPI
func NewSplitAPI(
	apikey string,
	conf conf.AdvancedConfig,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
) *SplitAPI {
	return &SplitAPI{
		AuthClient:         NewAuthAPIClient(apikey, conf, logger, metadata),
		SplitFetcher:       NewHTTPSplitFetcher(apikey, conf, logger, metadata),
		SegmentFetcher:     NewHTTPSegmentFetcher(apikey, conf, logger, metadata),
		ImpressionRecorder: NewHTTPImpressionRecorder(apikey, conf, logger),
		EventRecorder:      NewHTTPEventsRecorder(apikey, conf, logger),
		TelemetryRecorder:  NewHTTPTelemetryRecorder(apikey, conf, logger),
	}
}
