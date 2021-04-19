// Package durafmt formats time.Duration into a human readable format.
package durafmt

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	units, _   = DefaultUnitsCoder.Decode("year,week,day,hour,minute,second,millisecond,microsecond")
	unitsShort = []string{"y", "w", "d", "h", "m", "s", "ms", "µs"}
)

// Durafmt holds the parsed duration and the original input duration.
type Durafmt struct {
	duration  time.Duration
	input     string // Used as reference.
	limitN    int    // Non-zero to limit only first N elements to output.
	limitUnit string // Non-empty to limit max unit
}

// LimitToUnit sets the output format, you will not have unit bigger than the UNIT specified. UNIT = "" means no restriction.
func (d *Durafmt) LimitToUnit(unit string) *Durafmt {
	d.limitUnit = unit
	return d
}

// LimitFirstN sets the output format, outputing only first N elements. n == 0 means no limit.
func (d *Durafmt) LimitFirstN(n int) *Durafmt {
	d.limitN = n
	return d
}

func (d *Durafmt) Duration() time.Duration {
	return d.duration
}

// Parse creates a new *Durafmt struct, returns error if input is invalid.
func Parse(dinput time.Duration) *Durafmt {
	input := dinput.String()
	return &Durafmt{dinput, input, 0, ""}
}

// ParseShort creates a new *Durafmt struct, short form, returns error if input is invalid.
// It's shortcut for `Parse(dur).LimitFirstN(1)`
func ParseShort(dinput time.Duration) *Durafmt {
	input := dinput.String()
	return &Durafmt{dinput, input, 1, ""}
}

// ParseString creates a new *Durafmt struct from a string.
// returns an error if input is invalid.
func ParseString(input string) (*Durafmt, error) {
	if input == "0" || input == "-0" {
		return nil, errors.New("durafmt: missing unit in duration " + input)
	}
	duration, err := time.ParseDuration(input)
	if err != nil {
		return nil, err
	}
	return &Durafmt{duration, input, 0, ""}, nil
}

// ParseStringShort creates a new *Durafmt struct from a string, short form
// returns an error if input is invalid.
// It's shortcut for `ParseString(durStr)` and then calling `LimitFirstN(1)`
func ParseStringShort(input string) (*Durafmt, error) {
	if input == "0" || input == "-0" {
		return nil, errors.New("durafmt: missing unit in duration " + input)
	}
	duration, err := time.ParseDuration(input)
	if err != nil {
		return nil, err
	}
	return &Durafmt{duration, input, 1, ""}, nil
}

// String parses d *Durafmt into a human readable duration with default units.
func (d *Durafmt) String() string {
	return d.Format(units)
}

// Format parses d *Durafmt into a human readable duration with units.
func (d *Durafmt) Format(units Units) string {
	var duration string

	// Check for minus durations.
	if string(d.input[0]) == "-" {
		duration += "-"
		d.duration = -d.duration
	}

	var microseconds int64
	var milliseconds int64
	var seconds int64
	var minutes int64
	var hours int64
	var days int64
	var weeks int64
	var years int64
	var shouldConvert = false

	remainingSecondsToConvert := int64(d.duration / time.Microsecond)

	// Convert duration.
	if d.limitUnit == "" {
		shouldConvert = true
	}

	if d.limitUnit == "years" || shouldConvert {
		years = remainingSecondsToConvert / (365 * 24 * 3600 * 1000000)
		remainingSecondsToConvert -= years * 365 * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "weeks" || shouldConvert {
		weeks = remainingSecondsToConvert / (7 * 24 * 3600 * 1000000)
		remainingSecondsToConvert -= weeks * 7 * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "days" || shouldConvert {
		days = remainingSecondsToConvert / (24 * 3600 * 1000000)
		remainingSecondsToConvert -= days * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "hours" || shouldConvert {
		hours = remainingSecondsToConvert / (3600 * 1000000)
		remainingSecondsToConvert -= hours * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "minutes" || shouldConvert {
		minutes = remainingSecondsToConvert / (60 * 1000000)
		remainingSecondsToConvert -= minutes * 60 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "seconds" || shouldConvert {
		seconds = remainingSecondsToConvert / 1000000
		remainingSecondsToConvert -= seconds * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "milliseconds" || shouldConvert {
		milliseconds = remainingSecondsToConvert / 1000
		remainingSecondsToConvert -= milliseconds * 1000
	}

	microseconds = remainingSecondsToConvert

	// Create a map of the converted duration time.
	durationMap := []int64{
		microseconds,
		milliseconds,
		seconds,
		minutes,
		hours,
		days,
		weeks,
		years,
	}

	// Construct duration string.
	for i, u := range units.Units() {
		v := durationMap[7-i]
		strval := strconv.FormatInt(v, 10)
		switch {
		// add to the duration string if v > 1.
		case v > 1:
			duration += strval + " " + u.Plural + " "
		// remove the plural 's', if v is 1.
		case v == 1:
			duration += strval + " " + u.Singular + " "
		// omit any value with 0s or 0.
		case d.duration.String() == "0" || d.duration.String() == "0s":
			pattern := fmt.Sprintf("^-?0%s$", unitsShort[i])
			isMatch, err := regexp.MatchString(pattern, d.input)
			if err != nil {
				return ""
			}
			if isMatch {
				duration += strval + " " + u.Plural
			}

		// omit any value with 0.
		case v == 0:
			continue
		}
	}
	// trim any remaining spaces.
	duration = strings.TrimSpace(duration)

	// if more than 2 spaces present return the first 2 strings
	// if short version is requested
	if d.limitN > 0 {
		parts := strings.Split(duration, " ")
		if len(parts) > d.limitN*2 {
			duration = strings.Join(parts[:d.limitN*2], " ")
		}
	}

	return duration
}

func (d *Durafmt) InternationalString() string {
	var duration string

	// Check for minus durations.
	if string(d.input[0]) == "-" {
		duration += "-"
		d.duration = -d.duration
	}

	var microseconds int64
	var milliseconds int64
	var seconds int64
	var minutes int64
	var hours int64
	var days int64
	var weeks int64
	var years int64
	var shouldConvert = false

	remainingSecondsToConvert := int64(d.duration / time.Microsecond)

	// Convert duration.
	if d.limitUnit == "" {
		shouldConvert = true
	}

	if d.limitUnit == "years" || shouldConvert {
		years = remainingSecondsToConvert / (365 * 24 * 3600 * 1000000)
		remainingSecondsToConvert -= years * 365 * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "weeks" || shouldConvert {
		weeks = remainingSecondsToConvert / (7 * 24 * 3600 * 1000000)
		remainingSecondsToConvert -= weeks * 7 * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "days" || shouldConvert {
		days = remainingSecondsToConvert / (24 * 3600 * 1000000)
		remainingSecondsToConvert -= days * 24 * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "hours" || shouldConvert {
		hours = remainingSecondsToConvert / (3600 * 1000000)
		remainingSecondsToConvert -= hours * 3600 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "minutes" || shouldConvert {
		minutes = remainingSecondsToConvert / (60 * 1000000)
		remainingSecondsToConvert -= minutes * 60 * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "seconds" || shouldConvert {
		seconds = remainingSecondsToConvert / 1000000
		remainingSecondsToConvert -= seconds * 1000000
		shouldConvert = true
	}

	if d.limitUnit == "milliseconds" || shouldConvert {
		milliseconds = remainingSecondsToConvert / 1000
		remainingSecondsToConvert -= milliseconds * 1000
	}

	microseconds = remainingSecondsToConvert

	// Create a map of the converted duration time.
	durationMap := map[string]int64{
		"µs": microseconds,
		"ms": milliseconds,
		"s":  seconds,
		"m":  minutes,
		"h":  hours,
		"d":  days,
		"w":  weeks,
		"y":  years,
	}

	// Construct duration string.
	for i := range units.Units() {
		u := unitsShort[i]
		v := durationMap[u]
		strval := strconv.FormatInt(v, 10)
		switch {
		// add to the duration string if v > 1.
		case v > 1:
			duration += strval + " " + u + " "
		// remove the plural 's', if v is 1.
		case v == 1:
			duration += strval + " " + strings.TrimRight(u, "s") + " "
		// omit any value with 0s or 0.
		case d.duration.String() == "0" || d.duration.String() == "0s":
			pattern := fmt.Sprintf("^-?0%s$", unitsShort[i])
			isMatch, err := regexp.MatchString(pattern, d.input)
			if err != nil {
				return ""
			}
			if isMatch {
				duration += strval + " " + u
			}

		// omit any value with 0.
		case v == 0:
			continue
		}
	}
	// trim any remaining spaces.
	duration = strings.TrimSpace(duration)

	// if more than 2 spaces present return the first 2 strings
	// if short version is requested
	if d.limitN > 0 {
		parts := strings.Split(duration, " ")
		if len(parts) > d.limitN*2 {
			duration = strings.Join(parts[:d.limitN*2], " ")
		}
	}

	return duration
}
