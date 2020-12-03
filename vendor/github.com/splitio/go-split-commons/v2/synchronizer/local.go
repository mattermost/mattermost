package synchronizer

import (
	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/service"
	"github.com/splitio/go-split-commons/v2/storage"
	storageMock "github.com/splitio/go-split-commons/v2/storage/mocks"
	"github.com/splitio/go-split-commons/v2/synchronizer/worker/split"
	"github.com/splitio/go-split-commons/v2/tasks"
	"github.com/splitio/go-toolkit/v3/logging"
)

// Local implements Local Synchronizer
type Local struct {
	splitTasks          SplitTasks
	workers             Workers
	logger              logging.LoggerInterface
	inMememoryFullQueue chan string
}

// NewLocal creates new Local
func NewLocal(
	period int,
	splitAPI *service.SplitAPI,
	splitStorage storage.SplitStorage,
	logger logging.LoggerInterface,
) Synchronizer {
	metricStorageMock := storageMock.MockMetricStorage{
		IncCounterCall:   func(key string) {},
		IncLatencyCall:   func(metricName string, index int) {},
		PopCountersCall:  func() []dtos.CounterDTO { return make([]dtos.CounterDTO, 0, 0) },
		PopGaugesCall:    func() []dtos.GaugeDTO { return make([]dtos.GaugeDTO, 0, 0) },
		PopLatenciesCall: func() []dtos.LatenciesDTO { return make([]dtos.LatenciesDTO, 0, 0) },
		PutGaugeCall:     func(key string, gauge float64) {},
	}
	metricsWrapper := storage.NewMetricWrapper(metricStorageMock, nil, logger)
	workers := Workers{
		SplitFetcher: split.NewSplitFetcher(splitStorage, splitAPI.SplitFetcher, metricsWrapper, logger),
	}
	return &Local{
		splitTasks: SplitTasks{
			SplitSyncTask: tasks.NewFetchSplitsTask(workers.SplitFetcher, period, logger),
		},
		workers: workers,
		logger:  logger,
	}
}

// SyncAll syncs splits and segments
func (s *Local) SyncAll() error {
	return s.workers.SplitFetcher.SynchronizeSplits(nil)
}

// StartPeriodicFetching starts periodic fetchers tasks
func (s *Local) StartPeriodicFetching() {
	s.splitTasks.SplitSyncTask.Start()
}

// StopPeriodicFetching stops periodic fetchers tasks
func (s *Local) StopPeriodicFetching() {
	s.splitTasks.SplitSyncTask.Stop(false)
}

// StartPeriodicDataRecording starts periodic recorders tasks
func (s *Local) StartPeriodicDataRecording() {
}

// StopPeriodicDataRecording stops periodic recorders tasks
func (s *Local) StopPeriodicDataRecording() {
}

// SynchronizeSplits syncs splits
func (s *Local) SynchronizeSplits(till *int64) error {
	return s.workers.SplitFetcher.SynchronizeSplits(till)
}

// SynchronizeSegment syncs segment
func (s *Local) SynchronizeSegment(name string, till *int64) error {
	return nil
}
