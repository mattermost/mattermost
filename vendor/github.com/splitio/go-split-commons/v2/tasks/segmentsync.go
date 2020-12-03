package tasks

import (
	"errors"
	"fmt"
	"sync/atomic"

	"github.com/splitio/go-split-commons/v2/synchronizer/worker/segment"
	"github.com/splitio/go-toolkit/v3/asynctask"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/workerpool"
)

func updateSegments(
	fetcher segment.SegmentFetcher,
	admin *workerpool.WorkerAdmin,
	logger logging.LoggerInterface,
) error {
	segmentList := fetcher.SegmentNames()
	for _, name := range segmentList {
		ok := admin.QueueMessage(name)
		if !ok {
			logger.Error(
				fmt.Sprintf("Segment %s could not be added because the job queue is full.\n", name),
				fmt.Sprintf(
					"You currently have %d segments and the queue size is %d.\n",
					len(segmentList),
					admin.QueueSize(),
				),
				"Please consider updating the segment queue size accordingly in the configuration options",
			)
		}
	}
	return nil
}

// NewFetchSegmentsTask creates a new segment fetching and storing task
func NewFetchSegmentsTask(
	fetcher segment.SegmentFetcher,
	period int,
	workerCount int,
	queueSize int,
	logger logging.LoggerInterface,
) *asynctask.AsyncTask {

	admin := atomic.Value{}

	// After all segments are in sync, add workers to the pool that will keep them up to date
	// periodically
	onInit := func(logger logging.LoggerInterface) error {
		admin.Store(workerpool.NewWorkerAdmin(queueSize, logger))
		for i := 0; i < workerCount; i++ {
			worker := NewSegmentWorker(
				fmt.Sprintf("SegmentWorker_%d", i),
				0,
				fetcher.SynchronizeSegment,
			)
			admin.Load().(*workerpool.WorkerAdmin).AddWorker(worker)
		}
		return nil
	}

	update := func(logger logging.LoggerInterface) error {
		wa, ok := admin.Load().(*workerpool.WorkerAdmin)
		if !ok || wa == nil {
			return errors.New("unable to type-assert worker manager")
		}
		return updateSegments(fetcher, wa, logger)
	}

	cleanup := func(logger logging.LoggerInterface) {
		wa, ok := admin.Load().(*workerpool.WorkerAdmin)
		if !ok || wa == nil {
			logger.Error("unable to type-assert worker manager")
			return
		}
		wa.StopAll(true)
	}

	return asynctask.NewAsyncTask("UpdateSegments", update, period, onInit, cleanup, logger)
}
