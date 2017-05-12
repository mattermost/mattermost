package ec2

import (
	"time"
)

func fixedTime() time.Time {
	return time.Date(2012, 1, 1, 0, 0, 0, 0, time.UTC)
}

func FakeTime(fakeIt bool) {
	if fakeIt {
		timeNow = fixedTime
	} else {
		timeNow = time.Now
	}
}
