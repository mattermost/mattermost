package cluster

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
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
}

// JobConfig defines the configuration of a scheduled job.
type JobConfig struct {
	// Interval is the period of execution for the job.
	Interval time.Duration
}

// Job is a scheduled job whose callback function is executed on a configured interval by at most
// one plugin instance at a time.
//
// Use scheduled jobs to perform background activity on a regular interval without having to
// explicitly coordinate with other instances of the same plugin that might repeat that effort.
type Job struct {
	pluginAPI JobPluginAPI
	key       string
	mutex     *Mutex
	config    JobConfig
	callback  func()

	stopOnce sync.Once
	stop     chan bool
	done     chan bool
}

// jobMetadata persists metadata about job execution.
type jobMetadata struct {
	// LastFinished is the last time the job finished anywhere in the cluster.
	LastFinished time.Time
}

// Schedule creates a scheduled job.
func Schedule(pluginAPI JobPluginAPI, key string, config JobConfig, callback func()) (*Job, error) {
	if config.Interval == 0 {
		return nil, errors.Errorf("must specify non-zero job config interval")
	}

	key = cronPrefix + key

	job := &Job{
		pluginAPI: pluginAPI,
		key:       key,
		mutex:     NewMutex(pluginAPI, key),
		config:    config,
		callback:  callback,
		stop:      make(chan bool),
		done:      make(chan bool),
	}

	go job.run()

	return job, nil
}

// readMetadata reads the job execution metadata from the kv store.
func (j *Job) readMetadata() (jobMetadata, error) {
	data, appErr := j.pluginAPI.KVGet(j.key)
	if appErr != nil {
		return jobMetadata{}, errors.Wrap(appErr, "failed to read data")
	}

	if data == nil {
		return jobMetadata{}, nil
	}

	var metadata jobMetadata
	err := json.Unmarshal(data, &metadata)
	if err != nil {
		return jobMetadata{}, errors.Wrap(err, "failed to decode data")
	}

	return metadata, nil
}

// saveMetadata writes updated job execution metadata from the kv store.
//
// It is assumed that the job mutex is held, negating the need to require an atomic write.
func (j *Job) saveMetadata(metadata jobMetadata) error {
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
			sinceLastFinished := time.Since(metadata.LastFinished)
			if sinceLastFinished < j.config.Interval {
				waitInterval = j.config.Interval - sinceLastFinished
				return
			}

			// Run the job
			j.callback()

			metadata.LastFinished = time.Now()

			err = j.saveMetadata(metadata)
			if err != nil {
				j.pluginAPI.LogError("failed to write job data", "err", err, "key", j.key)
			}

			waitInterval = j.config.Interval
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
