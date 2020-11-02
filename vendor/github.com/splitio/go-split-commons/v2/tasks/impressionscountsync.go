package tasks

import (
	"github.com/splitio/go-split-commons/v2/synchronizer/worker/impressionscount"
	"github.com/splitio/go-toolkit/v3/asynctask"
	"github.com/splitio/go-toolkit/v3/logging"
)

const (
	period = 1800 // 30 min
)

// NewRecordImpressionsCountTask creates a new impressionsCount recording task
func NewRecordImpressionsCountTask(
	recorder impressionscount.ImpressionsCountRecorder,
	logger logging.LoggerInterface,
) *asynctask.AsyncTask {
	record := func(logger logging.LoggerInterface) error {
		return recorder.SynchronizeImpressionsCount()
	}

	onStop := func(logger logging.LoggerInterface) {
		recorder.SynchronizeImpressionsCount()
	}

	return asynctask.NewAsyncTask("SubmitImpressionsCount", record, period, nil, onStop, logger)
}
