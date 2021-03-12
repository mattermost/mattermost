package datatypes

import (
	"time"
)

const (
	// Number data type
	Number = "NUMBER"
	// Datetime data type
	Datetime = "DATETIME"
)

// TsFromJava converts a java timestamp to standard unix format
func TsFromJava(ts int64) int64 {
	return ts / 1000
}

// ZeroTimeTS Takes a timestamp in milliseconds as a parameter and
// returns another timestamp in seconds with the same date and zero time.
func ZeroTimeTS(ts int64) int64 {
	t := time.Unix(ts, 0).UTC() // Timestamp is converted from milliseconds to seconds
	rounded := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	return rounded.Unix()
}

// ZeroSecondsTS Takes a timestamp in milliseconds as a parameter and
// returns another timestamp in seconds with the same date & time but zero seconds.
func ZeroSecondsTS(ts int64) int64 {
	t := time.Unix(ts, 0).UTC() // Timestamp is converted from milliseconds to seconds
	rounded := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), 0, 0, time.UTC)
	return rounded.Unix()
}
