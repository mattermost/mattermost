package tasks

import (
	"github.com/splitio/go-split-commons/v3/telemetry"
	"github.com/splitio/go-toolkit/v4/asynctask"
	"github.com/splitio/go-toolkit/v4/logging"
)

// NewRecordTelemetryTask creates a new telemtry recording task
func NewRecordTelemetryTask(
	recorder telemetry.TelemetrySynchronizer,
	period int,
	logger logging.LoggerInterface,
) *asynctask.AsyncTask {
	record := func(logger logging.LoggerInterface) error {
		return recorder.SynchronizeStats()
	}

	onStop := func(l logging.LoggerInterface) {
		record(logger)
	}
	return asynctask.NewAsyncTask("SubmitTelemetry", record, period, nil, onStop, logger)
}
