package cluster

import "time"

func ExampleSchedule() {
	// Use p.API from your plugin instead.
	pluginAPI := NewMockMutexPluginAPI(nil)

	callback := func() {
		// periodic work to do
	}

	job, err := Schedule("key", JobConfig{Interval: 5 * time.Minute}, callback, pluginAPI)
	if err != nil {
		panic("failed to schedule job")
	}

	// main thread

	defer job.Close()
}
