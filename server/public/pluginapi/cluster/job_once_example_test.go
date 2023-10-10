package cluster

import (
	"log"
	"time"

	"github.com/mattermost/mattermost/server/public/plugin"
)

func HandleJobOnceCalls(key string, props any) {
	if key == "the key i'm watching for" {
		log.Println(props)
		// Work to do only once per cluster
	}
}

func ExampleJobOnceScheduler_ScheduleOnce() {
	// Use p.API from your plugin instead.
	pluginAPI := plugin.API(nil)

	// Get the scheduler, which you can pass throughout the plugin...
	scheduler := GetJobOnceScheduler(pluginAPI)

	// Set the plugin's callback handler
	_ = scheduler.SetCallback(HandleJobOnceCalls)

	// Now start the scheduler, which starts the poller and schedules all waiting jobs.
	_ = scheduler.Start()

	// main thread...

	// add a job
	_, _ = scheduler.ScheduleOnce("the key i'm watching for", time.Now().Add(2*time.Hour), struct{ foo string }{"aasd"})

	// Maybe you want to check the scheduled jobs, or cancel them. This is completely optional--there
	// is no need to cancel jobs, even if you are shutting down. Call Cancel only when you want to
	// cancel a future job. Cancelling a job will prevent it from running in the future on this or
	// any server.
	jobs, _ := scheduler.ListScheduledJobs()
	defer func() {
		for _, j := range jobs {
			scheduler.Cancel(j.Key)
		}
	}()
}
