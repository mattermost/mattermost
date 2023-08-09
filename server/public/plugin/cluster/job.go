package cluster

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	// cronPrefix is used to namespace key values created for a job from other key values
	// created by a plugin.
	cronPrefix = "cron_"
)

// JobPluginAPI is the plugin API interface required to schedule jobs.
type JobPluginAPI interface {
	MutexPluginAPI
	KVGet(key string) ([]byte, *model.AppError)
	KVDelete(key string) *model.AppError
	KVList(page, count int) ([]string, *model.AppError)
}

// JobConfig defines the configuration of a scheduled job.
type JobConfig struct {
	// Interval is the period of execution for the job.
	Interval time.Duration
}

// NextWaitInterval is a callback computing the next wait interval for a job.
type NextWaitInterval func(now time.Time, metadata JobMetadata) time.Duration

// MakeWaitForInterval creates a function to scheduling a job to run on the given interval relative
// to the last finished timestamp.
//
// For example, if the job first starts at 12:01 PM, and is configured with interval 5 minutes,
// it will next run at:
//
//	12:06, 12:11, 12:16, ...
//
// If the job has not previously started, it will run immediately.
func MakeWaitForInterval(interval time.Duration) NextWaitInterval {
	if interval == 0 {
		panic("must specify non-zero ready interval")
	}

	return func(now time.Time, metadata JobMetadata) time.Duration {
		sinceLastFinished := now.Sub(metadata.LastFinished)
		if sinceLastFinished < interval {
			return interval - sinceLastFinished
		}

		return 0
	}
}

// MakeWaitForRoundedInterval creates a function, scheduling a job to run on the nearest rounded
// interval relative to the last finished timestamp.
//
// For example, if the job first starts at 12:04 PM, and is configured with interval 5 minutes,
// and is configured to round to 5 minute intervals, it will next run at:
//
//	12:05 PM, 12:10 PM, 12:15 PM, ...
//
// If the job has not previously started, it will run immediately. Note that this wait interval
// strategy does not guarantee a minimum interval between runs, only that subsequent runs will be
// scheduled on the rounded interval.
func MakeWaitForRoundedInterval(interval time.Duration) NextWaitInterval {
	if interval == 0 {
		panic("must specify non-zero ready interval")
	}

	return func(now time.Time, metadata JobMetadata) time.Duration {
		if metadata.LastFinished.IsZero() {
			return 0
		}

		target := metadata.LastFinished.Add(interval).Truncate(interval)
		untilTarget := target.Sub(now)
		if untilTarget > 0 {
			return untilTarget
		}

		return 0
	}
}

// Job is a scheduled job whose callback function is executed on a configured interval by at most
// one plugin instance at a time.
//
// Use scheduled jobs to perform background activity on a regular interval without having to
// explicitly coordinate with other instances of the same plugin that might repeat that effort.
type Job struct {
	pluginAPI        JobPluginAPI
	key              string
	mutex            *Mutex
	nextWaitInterval NextWaitInterval
	callback         func()

	stopOnce sync.Once
	stop     chan bool
	done     chan bool
}

// JobMetadata persists metadata about job execution.
type JobMetadata struct {
	// LastFinished is the last time the job finished anywhere in the cluster.
	LastFinished time.Time
}

// Schedule creates a scheduled job.
func Schedule(pluginAPI JobPluginAPI, key string, nextWaitInterval NextWaitInterval, callback func()) (*Job, error) {
	key = cronPrefix + key

	mutex, err := NewMutex(pluginAPI, key)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create job mutex")
	}

	job := &Job{
		pluginAPI:        pluginAPI,
		key:              key,
		mutex:            mutex,
		nextWaitInterval: nextWaitInterval,
		callback:         callback,
		stop:             make(chan bool),
		done:             make(chan bool),
	}

	go job.run()

	return job, nil
}

// readMetadata reads the job execution metadata from the kv store.
func (j *Job) readMetadata() (JobMetadata, error) {
	data, appErr := j.pluginAPI.KVGet(j.key)
	if appErr != nil {
		return JobMetadata{}, errors.Wrap(appErr, "failed to read data")
	}

	if data == nil {
		return JobMetadata{}, nil
	}

	var metadata JobMetadata
	err := json.Unmarshal(data, &metadata)
	if err != nil {
		return JobMetadata{}, errors.Wrap(err, "failed to decode data")
	}

	return metadata, nil
}

// saveMetadata writes updated job execution metadata from the kv store.
//
// It is assumed that the job mutex is held, negating the need to require an atomic write.
func (j *Job) saveMetadata(metadata JobMetadata) error {
	data, err := json.Marshal(metadata)
	if err != nil {
		return errors.Wrap(err, "failed to marshal data")
	}

	ok, appErr := j.pluginAPI.KVSetWithOptions(j.key, data, model.PluginKVSetOptions{})
	if appErr != nil || !ok {
		return errors.Wrap(appErr, "failed to set data")
	}

	return nil
}

// run attempts to run the scheduled job, guaranteeing only one instance is executing concurrently.
func (j *Job) run() {
	defer close(j.done)

	var waitInterval time.Duration

	for {
		select {
		case <-j.stop:
			return
		case <-time.After(waitInterval):
		}

		func() {
			// Acquire the corresponding job lock and hold it throughout execution.
			j.mutex.Lock()
			defer j.mutex.Unlock()

			metadata, err := j.readMetadata()
			if err != nil {
				j.pluginAPI.LogError("failed to read job metadata", "err", err, "key", j.key)
				waitInterval = nextWaitInterval(waitInterval, err)
				return
			}

			// Is it time to run the job?
			waitInterval = j.nextWaitInterval(time.Now(), metadata)
			if waitInterval > 0 {
				return
			}

			// Run the job
			j.callback()

			metadata.LastFinished = time.Now()

			err = j.saveMetadata(metadata)
			if err != nil {
				j.pluginAPI.LogError("failed to write job data", "err", err, "key", j.key)
			}

			waitInterval = j.nextWaitInterval(time.Now(), metadata)
		}()
	}
}

// Close terminates a scheduled job, preventing it from being scheduled on this plugin instance.
func (j *Job) Close() error {
	j.stopOnce.Do(func() {
		close(j.stop)
	})
	<-j.done

	return nil
}
