package tasks

import (
	"github.com/splitio/go-split-commons/v2/synchronizer/worker/split"
	"github.com/splitio/go-toolkit/v3/asynctask"
	"github.com/splitio/go-toolkit/v3/logging"
)

// NewFetchSplitsTask creates a new splits fetching and storing task
func NewFetchSplitsTask(
	fetcher split.SplitFetcher,
	period int,
	logger logging.LoggerInterface,
) *asynctask.AsyncTask {
	update := func(logger logging.LoggerInterface) error {
		return fetcher.SynchronizeSplits(nil)
	}

	return asynctask.NewAsyncTask("UpdateSplits", update, period, nil, nil, logger)
}
