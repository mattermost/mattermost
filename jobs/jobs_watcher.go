// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"math/rand"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

const (
	WATCHER_POLLING_INTERVAL = 15000
)

type Watcher struct {
	workers *Workers

	stop    chan bool
	stopped chan bool
}

func MakeWatcher(workers *Workers) *Watcher {
	return &Watcher{
		stop:    make(chan bool, 1),
		stopped: make(chan bool, 1),
		workers: workers,
	}
}

func (watcher *Watcher) Start() {
	l4g.Debug("Watcher Started")

	// Delay for some random number of milliseconds before starting to ensure that multiple
	// instances of the jobserver  don't poll at a time too close to each other.
	rand.Seed(time.Now().UTC().UnixNano())
	_ = <-time.After(time.Duration(rand.Intn(WATCHER_POLLING_INTERVAL)) * time.Millisecond)

	defer func() {
		l4g.Debug("Watcher Finished")
		watcher.stopped <- true
	}()

	for {
		select {
		case <-watcher.stop:
			l4g.Debug("Watcher: Received stop signal")
			return
		case <-time.After(WATCHER_POLLING_INTERVAL * time.Millisecond):
			watcher.PollAndNotify()
		}
	}
}

func (watcher *Watcher) Stop() {
	l4g.Debug("Watcher Stopping")
	watcher.stop <- true
	<-watcher.stopped
}

func (watcher *Watcher) PollAndNotify() {
	if result := <-Srv.Store.Job().GetAllByStatus(model.JOB_STATUS_PENDING); result.Err != nil {
		l4g.Error("Error occured getting all pending statuses: %v", result.Err.Error())
	} else {
		jobStatuses := result.Data.([]*model.Job)

		for _, js := range jobStatuses {
			j := model.Job{
				Type: js.Type,
				Id:   js.Id,
			}

			if js.Type == model.JOB_TYPE_DATA_RETENTION {
				if watcher.workers.DataRetention != nil {
					select {
					case watcher.workers.DataRetention.JobChannel() <- j:
					default:
					}
				}
			} else if js.Type == model.JOB_TYPE_ELASTICSEARCH_POST_INDEXING {
				if watcher.workers.ElasticsearchIndexing != nil {
					select {
					case watcher.workers.ElasticsearchIndexing.JobChannel() <- j:
					default:
					}
				}
			}
		}
	}
}
