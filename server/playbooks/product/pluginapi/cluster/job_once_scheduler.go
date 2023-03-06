// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// syncedCallback uses the mutex to make things predictable for the client: the callback will be
// called once at a time (the client does not need to worry about concurrency within the callback)
type syncedCallback struct {
	mu       sync.Mutex
	callback func(string)
}

type syncedJobs struct {
	mu   sync.RWMutex
	jobs map[string]*JobOnce
}

type JobOnceScheduler struct {
	pluginAPI JobPluginAPI

	startedMu sync.RWMutex
	started   bool

	activeJobs     *syncedJobs
	storedCallback *syncedCallback
}

// GetJobOnceScheduler returns a scheduler which is ready to have its callback set. Repeated
// calls will return the same scheduler.
func GetJobOnceScheduler(pluginAPI JobPluginAPI) *JobOnceScheduler {
	return &JobOnceScheduler{
		pluginAPI: pluginAPI,
		activeJobs: &syncedJobs{
			jobs: make(map[string]*JobOnce),
		},
		storedCallback: &syncedCallback{},
	}
}

// Start starts the Scheduler. It finds all previous ScheduleOnce jobs and starts them running, and
// fires any jobs that have reached or exceeded their runAt time. Thus, even if a cluster goes down
// and is restarted, Start will restart previously scheduled jobs.
func (s *JobOnceScheduler) Start() error {
	s.startedMu.Lock()
	defer s.startedMu.Unlock()
	if s.started {
		return errors.New("scheduler has already been started")
	}

	if err := s.verifyCallbackExists(); err != nil {
		return errors.Wrap(err, "callback not found; cannot start scheduler")
	}

	if err := s.scheduleNewJobsFromDB(); err != nil {
		return errors.Wrap(err, "could not start JobOnceScheduler due to error")
	}

	go s.pollForNewScheduledJobs()

	s.started = true

	return nil
}

// SetCallback sets the scheduler's callback. When a job fires, the callback will be called with
// the job's id.
func (s *JobOnceScheduler) SetCallback(callback func(string)) error {
	if callback == nil {
		return errors.New("callback cannot be nil")
	}

	s.storedCallback.mu.Lock()
	defer s.storedCallback.mu.Unlock()

	s.storedCallback.callback = callback
	return nil
}

// ListScheduledJobs returns a list of the jobs in the db that have been scheduled. There is no
// guarantee that list is accurate by the time the caller reads the list. E.g., the jobs in the list
// may have been run, canceled, or new jobs may have scheduled.
func (s *JobOnceScheduler) ListScheduledJobs() ([]JobOnceMetadata, error) {
	var ret []JobOnceMetadata
	for i := 0; ; i++ {
		keys, err := s.pluginAPI.KVList(i, keysPerPage)
		if err != nil {
			return nil, errors.Wrap(err, "error getting KVList")
		}
		for _, k := range keys {
			if strings.HasPrefix(k, oncePrefix) {
				metadata, err := readMetadata(s.pluginAPI, k[len(oncePrefix):])
				if err != nil {
					logrus.WithError(err).WithField("key", k).Error("could not retrieve data from plugin kvstore")
					continue
				}
				if metadata == nil {
					continue
				}

				ret = append(ret, *metadata)
			}
		}

		if len(keys) < keysPerPage {
			break
		}
	}

	return ret, nil
}

// ScheduleOnce creates a scheduled job that will run once. When the clock reaches runAt, the
// callback will be called with key as the argument.
//
// If the job key already exists in the db, this will return an error. To reschedule a job, first
// cancel the original then schedule it again.
func (s *JobOnceScheduler) ScheduleOnce(key string, runAt time.Time) (*JobOnce, error) {
	s.startedMu.RLock()
	defer s.startedMu.RUnlock()
	if !s.started {
		return nil, errors.New("start the scheduler before adding jobs")
	}

	job, err := newJobOnce(s.pluginAPI, key, runAt, s.storedCallback, s.activeJobs)
	if err != nil {
		return nil, errors.Wrap(err, "could not create new job")
	}

	if err = job.saveMetadata(); err != nil {
		return nil, errors.Wrap(err, "could not save job metadata")
	}

	s.runAndTrack(job)

	return job, nil
}

// Cancel cancels a job by its key. This is useful if the plugin lost the original *JobOnce, or
// is stopping a job found in ListScheduledJobs().
func (s *JobOnceScheduler) Cancel(key string) {
	// using an anonymous function because job.Close() below needs access to the activeJobs mutex
	job := func() *JobOnce {
		s.activeJobs.mu.RLock()
		defer s.activeJobs.mu.RUnlock()
		j, ok := s.activeJobs.jobs[key]
		if ok {
			return j
		}

		// Job wasn't active, so no need to call CancelWhileHoldingMutex (which shuts down the
		// goroutine). There's a condition where another server in the cluster started the job, and
		// the current server hasn't polled for it yet. To solve that case, delete it from the db.
		mutex, err := NewMutex(s.pluginAPI, key)
		if err != nil {
			logrus.WithError(err).WithField("key", key).Error("failed to create job mutex in Cancel")
		}
		mutex.Lock()
		defer mutex.Unlock()

		_ = s.pluginAPI.KVDelete(oncePrefix + key)

		return nil
	}()

	if job != nil {
		job.Cancel()
	}
}

func (s *JobOnceScheduler) scheduleNewJobsFromDB() error {
	scheduled, err := s.ListScheduledJobs()
	if err != nil {
		return errors.Wrap(err, "could not read scheduled jobs from db")
	}

	for _, m := range scheduled {
		job, err := newJobOnce(s.pluginAPI, m.Key, m.RunAt, s.storedCallback, s.activeJobs)
		if err != nil {
			logrus.WithError(err).WithField("key", m.Key).Error("could not create new job")
			continue
		}

		s.runAndTrack(job)
	}

	return nil
}

func (s *JobOnceScheduler) runAndTrack(job *JobOnce) {
	s.activeJobs.mu.Lock()
	defer s.activeJobs.mu.Unlock()

	// has this been scheduled already on this server?
	if _, ok := s.activeJobs.jobs[job.key]; ok {
		return
	}

	go job.run()

	s.activeJobs.jobs[job.key] = job
}

// pollForNewScheduledJobs will only be started once per plugin. It doesn't need to be stopped.
func (s *JobOnceScheduler) pollForNewScheduledJobs() {
	for {
		<-time.After(pollNewJobsInterval + addJitter())

		if err := s.scheduleNewJobsFromDB(); err != nil {
			logrus.WithError(err).Error("scheduleOnce poller encountered an error but is still polling")
		}
	}
}

func (s *JobOnceScheduler) verifyCallbackExists() error {
	s.storedCallback.mu.Lock()
	defer s.storedCallback.mu.Unlock()

	if s.storedCallback.callback == nil {
		return errors.New("set callback before starting the scheduler")
	}
	return nil
}
