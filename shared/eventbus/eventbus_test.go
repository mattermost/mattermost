package eventbus

import (
	"context"
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

	t.Run("all events are handled, single subscriber", func(t *testing.T) {
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

	t.Run("can stop when handlers are stuck", func(t *testing.T) {
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

	t.Run("can stop when events publishing continues", func(t *testing.T) {
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

	t.Run("single subscriber, single event", func(t *testing.T) {

	})
}
