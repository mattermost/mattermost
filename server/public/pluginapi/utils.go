package pluginapi

import (
	"time"
)

func stringInSlice(a string, slice []string) bool {
	for _, b := range slice {
		if b == a {
			return true
		}
	}

	return false
}

var backoffTimeouts = []time.Duration{
	50 * time.Millisecond,
	100 * time.Millisecond,
	200 * time.Millisecond,
	200 * time.Millisecond,
	400 * time.Millisecond,
	400 * time.Millisecond,
}

// progressiveRetry executes a BackoffOperation and waits an increasing time before retrying the operation.
func progressiveRetry(operation func() error) error {
	var err error

	for attempts := 0; attempts < len(backoffTimeouts); attempts++ {
		err = operation()
		if err == nil {
			return nil
		}

		time.Sleep(backoffTimeouts[attempts])
	}

	return err
}
