// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"container/list"
	"context"
	"sync"
	"time"

	"github.com/pborman/uuid"

	"github.com/mattermost/platform/model"
)

type cometQueueListElement struct {
	UUID          string
	InsertionTime time.Time
}

type cometQueueMapElement struct {
	NextUUID string
	Event    *model.WebSocketEvent
}

type cometQueueWaitingResult struct {
	Result *CometResult
	Error  error
}

type cometQueueWaiting struct {
	Filter  func(*model.WebSocketEvent) bool
	Result  chan<- *cometQueueWaitingResult
	Context context.Context
}

type CometQueue struct {
	duration  time.Duration
	eventList *list.List
	eventMap  map[string]*cometQueueMapElement
	mutex     sync.Mutex
	waiting   *list.List
	lastUUID  string
}

type CometResult struct {
	ResumeToken string
	Event       *model.WebSocketEvent
}

func NewCometQueue(d time.Duration) *CometQueue {
	return &CometQueue{
		duration:  d,
		eventList: list.New(),
		eventMap:  make(map[string]*cometQueueMapElement),
		waiting:   list.New(),
	}
}

func (q *CometQueue) Insert(event *model.WebSocketEvent) {
	now := time.Now()
	cutoff := now.Add(-q.duration)

	q.mutex.Lock()
	defer q.mutex.Unlock()

	for e := q.eventList.Front(); e != nil; {
		v := e.Value.(*cometQueueListElement)
		if v.InsertionTime.After(cutoff) {
			break
		}
		next := e.Next()
		delete(q.eventMap, v.UUID)
		q.eventList.Remove(e)
		e = next
	}
	e := &cometQueueListElement{
		UUID:          uuid.New(),
		InsertionTime: now,
	}
	q.eventList.PushBack(e)
	q.eventMap[e.UUID] = &cometQueueMapElement{
		Event: event,
	}
	if prev, ok := q.eventMap[q.lastUUID]; ok {
		prev.NextUUID = e.UUID
	}
	q.lastUUID = e.UUID

	result := &cometQueueWaitingResult{
		Result: &CometResult{
			ResumeToken: e.UUID,
			Event:       event,
		},
	}
	for e := q.waiting.Front(); e != nil; {
		v := e.Value.(*cometQueueWaiting)
		select {
		case <-v.Context.Done():
		default:
			if v.Filter != nil && !v.Filter(event) {
				e = e.Next()
				continue
			}
			v.Result <- result
		}
		next := e.Next()
		q.waiting.Remove(e)
		e = next
	}
}

func (q *CometQueue) Next(ctx context.Context, resumeToken string, filter func(*model.WebSocketEvent) bool) (*CometResult, error) {
	q.mutex.Lock()

	if prev, ok := q.eventMap[resumeToken]; ok {
		for {
			if next, ok := q.eventMap[prev.NextUUID]; ok {
				if filter != nil && !filter(next.Event) {
					prev = next
					continue
				}
				q.mutex.Unlock()
				return &CometResult{
					ResumeToken: prev.NextUUID,
					Event:       next.Event,
				}, nil
			}
			break
		}
	}

	result := make(chan *cometQueueWaitingResult, 1)
	q.waiting.PushBack(&cometQueueWaiting{
		Filter:  filter,
		Result:  result,
		Context: ctx,
	})
	q.mutex.Unlock()

	select {
	case ret := <-result:
		return ret.Result, ret.Error
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
