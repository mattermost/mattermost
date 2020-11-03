package service

import (
	"github.com/splitio/go-split-commons/v2/conf"
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/service/api"
	"github.com/splitio/go-toolkit/v3/logging"
)

// SplitAPI struct for fetchers and recorders
type SplitAPI struct {
	AuthClient         AuthClient
	SplitFetcher       SplitFetcher
	SegmentFetcher     SegmentFetcher
	ImpressionRecorder ImpressionsRecorder
	EventRecorder      EventsRecorder
	MetricRecorder     MetricsRecorder
}

// NewSplitAPI creates new splitAPI
func NewSplitAPI(
	apikey string,
	conf conf.AdvancedConfig,
	logger logging.LoggerInterface,
	metadata dtos.Metadata,
) *SplitAPI {
	return &SplitAPI{
		AuthClient:         api.NewAuthAPIClient(apikey, conf, logger, metadata),
		SplitFetcher:       api.NewHTTPSplitFetcher(apikey, conf, logger, metadata),
		SegmentFetcher:     api.NewHTTPSegmentFetcher(apikey, conf, logger, metadata),
		ImpressionRecorder: api.NewHTTPImpressionRecorder(apikey, conf, logger),
		EventRecorder:      api.NewHTTPEventsRecorder(apikey, conf, logger),
		MetricRecorder:     api.NewHTTPMetricsRecorder(apikey, conf, logger),
	}
}
