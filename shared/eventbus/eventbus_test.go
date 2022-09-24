package eventbus

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestBrokerStop(t *testing.T) {
	t.Run("all events are handled, single subscriber", func(t *testing.T) {
		bs := NewBroker(8, 2, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})
		var publishedEventsCount int32
		handler := func(ev Event) error {
			time.Sleep(100 * time.Millisecond)
			atomic.AddInt32(&publishedEventsCount, 1)
			return nil
		}
		bs.Subscribe("topic", handler)

		for i := 0; i < 10; i++ {
			bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		}

		err := bs.Stop()
		require.NoError(t, err)
		// verify that all events are handled
		require.Equal(t, int32(10), publishedEventsCount)

		// should not accept any more events
		err = bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		require.Error(t, err)
	})

	t.Run("all events are handled, multiple subscribers", func(t *testing.T) {
		bs := NewBroker(8, 3, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})
		var publishedEventsCount1, publishedEventsCount2 int32
		handler1 := func(ev Event) error {
			time.Sleep(100 * time.Millisecond)
			atomic.AddInt32(&publishedEventsCount1, 1)
			return nil
		}
		handler2 := func(ev Event) error {
			time.Sleep(100 * time.Millisecond)
			atomic.AddInt32(&publishedEventsCount2, 1)
			return nil
		}
		bs.Subscribe("topic", handler1)
		bs.Subscribe("topic", handler2)

		for i := 0; i < 10; i++ {
			bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		}

		err := bs.Stop()
		require.NoError(t, err)
		// verify that all events are handled
		require.Equal(t, int32(10), publishedEventsCount1)
		require.Equal(t, int32(10), publishedEventsCount2)

		// should not accept any more events
		err = bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		require.Error(t, err)
	})

	t.Run("handlers are stuck", func(t *testing.T) {
		bs := NewBroker(9, 3, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})
		var publishedEventsCount int32
		handler := func(ev Event) error {
			time.Sleep(time.Second)
			atomic.AddInt32(&publishedEventsCount, 1)
			return nil
		}
		bs.Subscribe("topic", handler)

		for i := 0; i < 10; i++ {
			bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		}

		err := bs.Stop()
		require.Error(t, err)

		// should not accept any more events
		err = bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		require.Error(t, err)
	})

	t.Run("publishing events continues", func(t *testing.T) {
		bs := NewBroker(8, 2, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})
		handler := func(ev Event) error {
			time.Sleep(100 * time.Millisecond)
			return nil
		}
		bs.Subscribe("topic", handler)

		quit := make(chan bool)
		go func() {
			for {
				select {
				case <-quit:
					return
				default:
					time.Sleep(10 * time.Millisecond)
					bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
				}
			}
		}()

		bs.Stop()
		err := bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		require.Error(t, err)
		quit <- true
	})
}

func TestBrokerSubscribePublish(t *testing.T) {

	t.Run("no subscribers", func(t *testing.T) {
		bs := NewBroker(4, 4, 4*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})
		for i := 0; i < 10; i++ {
			bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		}
		err := bs.Stop()
		require.NoError(t, err)

		err = bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		require.Error(t, err)
	})

	t.Run("single subscriber, no parallel goroutines", func(t *testing.T) {
		// no parallel goroutines, so order publishing and handling events will be the same
		bs := NewBroker(10, 1, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})

		var mu sync.Mutex
		requestIdsActual := make([]string, 0)
		handler := func(ev Event) error {
			time.Sleep(10 * time.Millisecond)
			mu.Lock()
			defer mu.Unlock()
			requestIdsActual = append(requestIdsActual, ev.requestID)
			return nil
		}
		bs.Subscribe("topic", handler)

		requestIdsExpected := make([]string, 0)
		for i := 0; i < 100; i++ {
			requestId := model.NewId()
			requestIdsExpected = append(requestIdsExpected, requestId)
			bs.Publish("topic", request.NewContext(context.Background(), requestId, model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		}

		// wait until all events are handled
		time.Sleep(2 * time.Second)
		require.Equal(t, requestIdsExpected, requestIdsActual)
	})

	t.Run("multiple subscribers, parallel goroutines", func(t *testing.T) {
		bs := NewBroker(100, 80, 3*time.Second)
		bs.Start()
		bs.Register("topic", "description", struct{}{})

		var mu sync.Mutex
		const numOfSubscribers = 4
		subscribersIds := make([]string, 0)
		// map[subscriber id <> map[event topic <> set[event id]]]
		requestIdsActual := make(map[string]map[string]map[string]bool)
		for i := 0; i < numOfSubscribers; i++ {
			subscriberIndex := i
			handler := func(ev Event) error {
				time.Sleep(10 * time.Millisecond)
				mu.Lock()
				defer mu.Unlock()
				addEventToMap(requestIdsActual, subscribersIds[subscriberIndex], ev.Topic, ev.requestID)
				return nil
			}
			id, err := bs.Subscribe("topic", handler)
			require.NoError(t, err)
			subscribersIds = append(subscribersIds, id)
		}

		requestIdsExpected := make(map[string]map[string]map[string]bool)
		go func() {
			for k := 0; k < 1000; k++ {
				// time.Sleep(10 * time.Millisecond)
				requestId := model.NewId()
				for i := 0; i < numOfSubscribers; i++ {
					addEventToMap(requestIdsExpected, subscribersIds[i], "topic", requestId)
				}
				bs.Publish("topic", request.NewContext(context.Background(), requestId, model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
			}
		}()

		// wait some time to handle already published events
		time.Sleep(5 * time.Second)
		require.Equal(t, requestIdsExpected, requestIdsActual)
	})
}

func addEventToMap(eventsMap map[string]map[string]map[string]bool, subscriberId string, topic, requestID string) {
	if _, ok := eventsMap[subscriberId]; !ok {
		eventsMap[subscriberId] = make(map[string]map[string]bool)
	}
	if _, ok := eventsMap[subscriberId][topic]; !ok {
		eventsMap[subscriberId][topic] = make(map[string]bool)
	}
	eventsMap[subscriberId][topic][requestID] = true
}
