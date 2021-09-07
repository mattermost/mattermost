package util

import "time"

const dedupWindowSizeMs = 3600 * 1000

// TruncateTimeFrame truncates de time frame received with the time window
func TruncateTimeFrame(timestampInNs int64) int64 {
	timestampInMs := timestampInNs / int64(time.Millisecond)
	return timestampInMs - (timestampInMs % dedupWindowSizeMs)
}
