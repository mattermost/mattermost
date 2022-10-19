package eventbus

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/invopop/jsonschema"
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
		mu.Lock()
		defer mu.Unlock()
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
		mu.Lock()
		defer mu.Unlock()
		require.Equal(t, requestIdsExpected, requestIdsActual)
	})
}

func TestSubscribeUnsubscribe(t *testing.T) {
	t.Run("subscribe/unsubscribe race condition", func(t *testing.T) {
		bs := NewBroker(10, 4, 3*time.Second)
		bs.Register("topic", "description", struct{}{})
		bs.Start()

		var numEvents int32
		var mu sync.Mutex
		subscribersIds := make([]string, 0)
		// run Subscribe from multiple goroutines
		numGoroutines := 10
		numSubscribers := 100
		for i := 0; i < numGoroutines; i++ {
			go func() {
				for j := 0; j < numSubscribers; j++ {
					handler := func(ev Event) error {
						atomic.AddInt32(&numEvents, 1)
						return nil
					}
					id, err := bs.Subscribe("topic", handler)
					require.NoError(t, err)
					mu.Lock()
					subscribersIds = append(subscribersIds, id)
					mu.Unlock()
				}
			}()
		}

		// wait some time to finish subscribing process
		time.Sleep(2 * time.Second)
		bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)

		// wait some time so event is processed by handlers
		time.Sleep(2 * time.Second)
		actual := atomic.LoadInt32(&numEvents)
		require.Equal(t, int32(1000), actual)

		// run Unsubscribe from multiple goroutines
		for i := 0; i < numGoroutines; i++ {
			iCopy := i
			go func() {
				for j := 0; j < numSubscribers; j++ {
					err := bs.Unsubscribe("topic", subscribersIds[iCopy*numSubscribers+j])
					require.NoError(t, err)
				}
			}()
		}

		// wait some time to finish subscribing process
		time.Sleep(2 * time.Second)
		atomic.StoreInt32(&numEvents, 0)
		bs.Publish("topic", request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil), nil)
		time.Sleep(time.Second)
		actual = atomic.LoadInt32(&numEvents)
		require.Equal(t, int32(0), actual)
	})

	t.Run("subscribe on topic that is not registered", func(t *testing.T) {
		bs := NewBroker(2, 1, time.Second)
		bs.Register("topic", "description", struct{}{})
		_, err := bs.Subscribe("invalid topic", func(ev Event) error { return nil })
		require.Error(t, err)
	})

	t.Run("unsubscribe with incorrect id", func(t *testing.T) {
		bs := NewBroker(2, 9, time.Second)
		bs.Register("topic", "description", struct{}{})
		id, err := bs.Subscribe("topic", func(ev Event) error { return nil })
		require.NoError(t, err)
		err = bs.Unsubscribe("topic", "invalid id")
		require.Error(t, err)
		err = bs.Unsubscribe("topic", id)
		require.NoError(t, err)
	})

	t.Run("unsubscribe with incorrect topic", func(t *testing.T) {
		bs := NewBroker(2, 9, time.Second)
		bs.Register("topic", "description", struct{}{})
		id, err := bs.Subscribe("topic", func(ev Event) error { return nil })
		require.NoError(t, err)
		err = bs.Unsubscribe("incorrect topic", id)
		require.Error(t, err)
	})
}

func TestRegistration(t *testing.T) {
	t.Run("register race condition", func(t *testing.T) {
		bs := NewBroker(100, 80, 3*time.Second)
		bs.Start()

		schema := jsonschema.Reflect(struct{}{})
		buf, _ := schema.MarshalJSON()
		schemaJSON := string(buf)

		numGoroutines := 10
		numTopics := 2
		topicsExpected := make([]EventType, 0)
		for i := 0; i < numGoroutines; i++ {
			for j := 0; j < numTopics; j++ {
				id := i*numTopics + j
				topicName := fmt.Sprintf("topic %d", id)
				topicDescription := fmt.Sprintf("description %d", id)

				topicsExpected = append(topicsExpected, EventType{
					Topic:       topicName,
					Description: topicDescription,
					Schema:      schemaJSON,
				})
			}
		}
		sort.Slice(topicsExpected, func(i, j int) bool {
			return topicsExpected[i].Topic < topicsExpected[j].Topic
		})

		for i := 0; i < numGoroutines; i++ {
			iCopy := i
			go func() {
				for j := 0; j < numTopics; j++ {
					index := iCopy*numTopics + j
					err := bs.Register(topicsExpected[index].Topic, topicsExpected[index].Description, struct{}{})
					require.NoError(t, err)
				}
			}()
		}

		// wait some time to finish registration process
		time.Sleep(2 * time.Second)

		topicsActual := bs.EventTypes()
		require.Equal(t, topicsExpected, topicsActual)
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
