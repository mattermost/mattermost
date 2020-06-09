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
	units      = []string{"years", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds"}
	unitsShort = []string{"y", "w", "d", "h", "m", "s", "ms", "µs"}
)

// Durafmt holds the parsed duration and the original input duration.
type Durafmt struct {
	duration time.Duration
	input    string // Used as reference.
	limitN   int    // Non-zero to limit only first N elements to output.
}

// LimitFirstN sets the output format, outputing only first N elements. n == 0 means no limit.
func (d *Durafmt) LimitFirstN(n int) *Durafmt {
	d.limitN = n
	return d
}

// Parse creates a new *Durafmt struct, returns error if input is invalid.
func Parse(dinput time.Duration) *Durafmt {
	input := dinput.String()
	return &Durafmt{dinput, input, 0}
}

// ParseShort creates a new *Durafmt struct, short form, returns error if input is invalid.
// It's shortcut for `Parse(dur).LimitFirstN(1)`
func ParseShort(dinput time.Duration) *Durafmt {
	input := dinput.String()
	return &Durafmt{dinput, input, 1}
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
	return &Durafmt{duration, input, 0}, nil
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
	return &Durafmt{duration, input, 1}, nil
}

// String parses d *Durafmt into a human readable duration.
func (d *Durafmt) String() string {
	var duration string

	// Check for minus durations.
	if string(d.input[0]) == "-" {
		duration += "-"
		d.duration = -d.duration
	}

	// Convert duration.
	seconds := int64(d.duration.Seconds()) % 60
	minutes := int64(d.duration.Minutes()) % 60
	hours := int64(d.duration.Hours()) % 24
	days := int64(d.duration/(24*time.Hour)) % 365 % 7

	// Edge case between 364 and 365 days.
	// We need to calculate weeks from what is left from years
	leftYearDays := int64(d.duration/(24*time.Hour)) % 365
	weeks := leftYearDays / 7
	if leftYearDays >= 364 && leftYearDays < 365 {
		weeks = 52
	}

	years := int64(d.duration/(24*time.Hour)) / 365
	milliseconds := int64(d.duration/time.Millisecond) -
		(seconds * 1000) - (minutes * 60000) - (hours * 3600000) -
		(days * 86400000) - (weeks * 604800000) - (years * 31536000000)

	microseconds := int64(d.duration/time.Microsecond) -
		(milliseconds * 1000) - (seconds * 1000000) - (minutes * 60000000) - (hours * 3600000000) -
		(days * 86400000000) - (weeks * 604800000000) - (years * 31536000000000)

	// Create a map of the converted duration time.
	durationMap := map[string]int64{
		"microseconds": microseconds,
		"milliseconds": milliseconds,
		"seconds":      seconds,
		"minutes":      minutes,
		"hours":        hours,
		"days":         days,
		"weeks":        weeks,
		"years":        years,
	}

	// Construct duration string.
	for i := range units {
		u := units[i]
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
