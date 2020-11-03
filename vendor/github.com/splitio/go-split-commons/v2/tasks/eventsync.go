package tasks

import (
	"fmt"
	"sync"

	"github.com/splitio/go-split-commons/v2/synchronizer/worker/event"
	"github.com/splitio/go-toolkit/v3/asynctask"
	"github.com/splitio/go-toolkit/v3/logging"
)

// NewRecordEventsTask creates a new events recording task
func NewRecordEventsTask(
	synchronizer event.EventRecorder,
	bulkSize int64,
	period int,
	logger logging.LoggerInterface,
) Task {
	record := func(logger logging.LoggerInterface) error {
		return synchronizer.SynchronizeEvents(bulkSize)
	}

	onStop := func(logger logging.LoggerInterface) {
		// All this function does is flush events which will clear the storage
		synchronizer.FlushEvents(bulkSize)
	}

	return asynctask.NewAsyncTask("SubmitEvents", record, period, nil, onStop, logger)
}

// NewRecordEventsTasks creates a new splits fetching and storing task
func NewRecordEventsTasks(
	recorder event.EventRecorder,
	bulkSize int64,
	period int,
	logger logging.LoggerInterface,
	totalTasks int) Task {
	record := func(logger logging.LoggerInterface) error {
		return recorder.SynchronizeEvents(bulkSize)
	}

	tasks := make([]Task, 0, totalTasks)
	for i := 0; i < totalTasks; i++ {
		logger.Info(fmt.Sprintf("Creating SubmitEvents_%d", i))
		tasks = append(tasks, asynctask.NewAsyncTask(fmt.Sprintf("SubmitEvents_%d", i), record, period, nil, nil, logger))
	}
	return MultipleTask{
		logger: logger,
		tasks:  tasks,
		wg:     &sync.WaitGroup{},
	}
}
