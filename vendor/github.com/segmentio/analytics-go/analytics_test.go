package analytics

import "net/http/httptest"
import "encoding/json"
import "net/http"
import "testing"
import "bytes"
import "time"
import "fmt"
import "io"

func mockId() string { return "I'm unique" }

func mockTime() time.Time {
	// time.Unix(0, 0) fails on Circle
	return time.Date(2009, time.November, 10, 23, 0, 0, 0, time.UTC)
}

func mockServer() (chan []byte, *httptest.Server) {
	done := make(chan []byte, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := bytes.NewBuffer(nil)
		io.Copy(buf, r.Body)

		var v interface{}
		err := json.Unmarshal(buf.Bytes(), &v)
		if err != nil {
			panic(err)
		}

		b, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			panic(err)
		}

		done <- b
	}))

	return done, server
}

func ExampleTrack() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 1

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
	})

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleClose() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
	})

	client.Close()

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleInterval() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
	})

	// Will flush in 5 seconds (default interval).
	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleTrackWithTimestampSet() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 1

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
		Message: Message{
			Timestamp: timestamp(time.Date(2015, time.July, 10, 23, 0, 0, 0, time.UTC)),
		},
	})

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2015-07-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleTrackWithMessageIdSet() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 1

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
		Message: Message{
			MessageId: "abc",
		},
	})

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "abc",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleTrack_context() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 1

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
		Context: map[string]interface{}{
			"whatever": "here",
		},
	})

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "context": {
	//         "whatever": "here"
	//       },
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleTrack_many() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 3

	for i := 0; i < 5; i++ {
		client.Track(&Track{
			Event:  "Download",
			UserId: "123456",
			Properties: map[string]interface{}{
				"application": "Segment Desktop",
				"version":     i,
			},
		})
	}

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "version": 0
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     },
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "version": 1
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     },
	//     {
	//       "event": "Download",
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "version": 2
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

func ExampleTrackWithIntegrations() {
	body, server := mockServer()
	defer server.Close()

	client := New("h97jamjwbh")
	client.Endpoint = server.URL
	client.now = mockTime
	client.uid = mockId
	client.Size = 1

	client.Track(&Track{
		Event:  "Download",
		UserId: "123456",
		Properties: map[string]interface{}{
			"application": "Segment Desktop",
			"version":     "1.1.0",
			"platform":    "osx",
		},
		Integrations: map[string]interface{}{
			"All":      true,
			"Intercom": false,
			"Mixpanel": true,
		},
	})

	fmt.Printf("%s\n", <-body)
	// Output:
	// {
	//   "batch": [
	//     {
	//       "event": "Download",
	//       "integrations": {
	//         "All": true,
	//         "Intercom": false,
	//         "Mixpanel": true
	//       },
	//       "messageId": "I'm unique",
	//       "properties": {
	//         "application": "Segment Desktop",
	//         "platform": "osx",
	//         "version": "1.1.0"
	//       },
	//       "timestamp": "2009-11-10T23:00:00+0000",
	//       "type": "track",
	//       "userId": "123456"
	//     }
	//   ],
	//   "context": {
	//     "library": {
	//       "name": "analytics-go",
	//       "version": "2.1.0"
	//     }
	//   },
	//   "messageId": "I'm unique",
	//   "sentAt": "2009-11-10T23:00:00+0000"
	// }
}

// Tests that calling Close right after creating the client object doesn't
// block.
// Bug: https://github.com/segmentio/analytics-go/issues/43
func TestCloseFinish(_ *testing.T) {
	c := New("test")
	c.Close()
}
