// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"context"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
)

func cometQueueInserter(q *CometQueue) *time.Ticker {
	ticker := time.NewTicker(time.Millisecond * 5)
	go func() {
		i := 0
		for _ = range ticker.C {
			q.Insert(&model.WebSocketEvent{
				Sequence: int64(i),
			})
			i++
		}
	}()
	return ticker
}

func TestCometQueue(t *testing.T) {
	q := NewCometQueue(time.Hour)

	inserter := cometQueueInserter(q)
	prev := &CometResult{}
	for i := 0; i < 10; i++ {
		result, _ := q.Next(context.Background(), prev.ResumeToken, func(event *model.WebSocketEvent) bool {
			return event.Sequence%2 == 0
		})
		if result.Event.Sequence%2 > 0 || (i > 0 && result.Event.Sequence != prev.Event.Sequence+2) {
			t.Fatal("unexpected sequence number")
		}
		prev = result
	}
	inserter.Stop()
}

func TestCometQueue_Deadline(t *testing.T) {
	q := NewCometQueue(time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		cancel()
	}()
	q.Next(ctx, "", nil)
}

func BenchmarkCometQueue_Insert(b *testing.B) {
	q := NewCometQueue(time.Hour)
	for n := 0; n < b.N; n++ {
		q.Insert(&model.WebSocketEvent{})
	}
}

func BenchmarkCometQueue_Next(b *testing.B) {
	q := NewCometQueue(time.Hour)
	inserter := cometQueueInserter(q)
	result, _ := q.Next(context.Background(), "", nil)
	resumeToken := result.ResumeToken
	inserter.Stop()
	for i := 0; i < b.N; i++ {
		q.Insert(&model.WebSocketEvent{
			Sequence: int64(i),
		})
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, _ = q.Next(context.Background(), resumeToken, nil)
		resumeToken = result.ResumeToken
	}
}
