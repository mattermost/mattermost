package timeconv

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// MillisPerSecond is the number of millseconds per second.
const MillisPerSecond int64 = 1000

// MillisPerMinute is the number of millseconds per minute.
const MillisPerMinute int64 = MillisPerSecond * 60

// MillisPerHour is the number of millseconds per hour.
const MillisPerHour int64 = MillisPerMinute * 60

// MillisPerDay is the number of millseconds per day.
const MillisPerDay int64 = MillisPerHour * 24

// MillisPerWeek is the number of millseconds per week.
const MillisPerWeek int64 = MillisPerDay * 7

// MillisPerYear is the approximate number of millseconds per year.
const MillisPerYear int64 = MillisPerDay*365 + int64((float64(MillisPerDay) * 0.25))

// ParseMilliseconds parses a string containing a number plus
// a unit of measure for time and returns the number of milliseconds
// it represents.
//
// Example:
// * "1 second" returns 1000
// * "1 minute" returns 60000
// * "1 hour" returns 3600000
//
// See config.UnitsToMillis for a list of supported units of measure.
func ParseMilliseconds(str string) (int64, error) {
	s := strings.TrimSpace(str)
	reg := regexp.MustCompile("([0-9\\.\\-+]*)(.*)")
	matches := reg.FindStringSubmatch(s)
	if matches == nil || len(matches) < 1 || matches[1] == "" {
		return 0, fmt.Errorf("invalid syntax - '%s'", s)
	}
	digits := matches[1]
	units := "ms"
	if len(matches) > 1 && matches[2] != "" {
		units = matches[2]
	}

	fDigits, err := strconv.ParseFloat(digits, 64)
	if err != nil {
		return 0, err
	}

	msPerUnit, err := UnitsToMillis(units)
	if err != nil {
		return 0, err
	}

	// Check for overflow.
	fms := float64(msPerUnit) * fDigits
	if fms > math.MaxInt64 || fms < math.MinInt64 {
		return 0, fmt.Errorf("out of range - '%s' overflows", s)
	}
	ms := int64(fms)
	return ms, nil
}

// UnitsToMillis returns the number of milliseconds represented by the specified unit of measure.
//
// Example:
// * "second" returns 1000	<br/>
// * "minute" returns 60000	<br/>
// * "hour" returns 3600000	<br/>
//
// Supported units of measure:
// * "milliseconds", "millis", "ms", "millisecond"
// * "seconds", "sec", "s", "second"
// * "minutes", "mins", "min", "m", "minute"
// * "hours", "h", "hour"
// * "days", "d", "day"
// * "weeks", "w", "week"
// * "years", "y", "year"
func UnitsToMillis(units string) (ms int64, err error) {
	u := strings.TrimSpace(units)
	u = strings.ToLower(u)
	switch u {
	case "milliseconds", "millisecond", "millis", "ms":
		ms = 1
	case "seconds", "second", "sec", "s":
		ms = MillisPerSecond
	case "minutes", "minute", "mins", "min", "m":
		ms = MillisPerMinute
	case "hours", "hour", "h":
		ms = MillisPerHour
	case "days", "day", "d":
		ms = MillisPerDay
	case "weeks", "week", "w":
		ms = MillisPerWeek
	case "years", "year", "y":
		ms = MillisPerYear
	default:
		err = fmt.Errorf("invalid syntax - '%s' not a supported unit of measure", u)
	}
	return
}
