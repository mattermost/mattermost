package tasks

import (
	"fmt"
	"sync"

	"github.com/splitio/go-split-commons/v2/synchronizer/worker/impression"
	"github.com/splitio/go-toolkit/v3/asynctask"
	"github.com/splitio/go-toolkit/v3/logging"
)

// NewRecordImpressionsTask creates a new splits fetching and storing task
func NewRecordImpressionsTask(
	recorder impression.ImpressionRecorder,
	period int,
	logger logging.LoggerInterface,
	bulkSize int64,
) Task {
	record := func(logger logging.LoggerInterface) error {
		return recorder.SynchronizeImpressions(bulkSize)
	}

	onStop := func(logger logging.LoggerInterface) {
		// All this function does is flush impressions which will clear the storage
		recorder.FlushImpressions(bulkSize)
	}

	return asynctask.NewAsyncTask("SubmitImpressions", record, period, nil, onStop, logger)
}

// NewRecordImpressionsTasks creates a new splits fetching and storing task
func NewRecordImpressionsTasks(
	recorder impression.ImpressionRecorder,
	period int,
	logger logging.LoggerInterface,
	bulkSize int64,
	totalTasks int) Task {
	record := func(logger logging.LoggerInterface) error {
		return recorder.SynchronizeImpressions(bulkSize)
	}

	tasks := make([]Task, 0, totalTasks)
	for i := 0; i < totalTasks; i++ {
		logger.Info(fmt.Sprintf("Creating SubmitImpressions_%d", i))
		tasks = append(tasks, asynctask.NewAsyncTask(fmt.Sprintf("SubmitImpressions_%d", i), record, period, nil, nil, logger))
	}
	return MultipleTask{
		logger: logger,
		tasks:  tasks,
		wg:     &sync.WaitGroup{},
	}
}
