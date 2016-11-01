package main

import "github.com/segmentio/analytics-go"
import "time"

func main() {
	client := analytics.New("h97jamjwbh")
	client.Interval = 30 * time.Second
	client.Size = 100
	client.Verbose = true

	done := time.After(3 * time.Second)
	tick := time.Tick(50 * time.Millisecond)

out:
	for {
		select {
		case <-done:
			println("exiting")
			break out
		case <-tick:
			client.Track(&analytics.Track{
				Event:  "Download",
				UserId: "123456",
				Properties: map[string]interface{}{
					"application": "Segment Desktop",
					"version":     "1.1.0",
					"platform":    "osx",
				},
			})
		}
	}

	println("flushing")
	client.Close()
}
