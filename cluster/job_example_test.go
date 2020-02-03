package cluster

import "time"

func ExampleSchedule() {
	// Use p.API from your plugin instead.
	pluginAPI := NewMockMutexPluginAPI(nil)

	callback := func() {
		// periodic work to do
	}

	job, err := Schedule(pluginAPI, "key", JobConfig{Interval: 5 * time.Minute}, callback)
	if err != nil {
		panic("failed to schedule job")
	}

	// main thread

	defer job.Close()
}
