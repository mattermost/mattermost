package tasks

import (
	"github.com/splitio/go-split-commons/v3/synchronizer/worker/split"
	"github.com/splitio/go-toolkit/v4/asynctask"
	"github.com/splitio/go-toolkit/v4/logging"
)

// NewFetchSplitsTask creates a new splits fetching and storing task
func NewFetchSplitsTask(
	fetcher split.Updater,
	period int,
	logger logging.LoggerInterface,
) *asynctask.AsyncTask {
	update := func(logger logging.LoggerInterface) error {
		_, err := fetcher.SynchronizeSplits(nil, false)
		return err
	}

	return asynctask.NewAsyncTask("UpdateSplits", update, period, nil, nil, logger)
}
