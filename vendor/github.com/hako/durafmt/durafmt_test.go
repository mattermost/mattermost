package durafmt

import (
	"testing"
	"time"
)

var (
	testStrings []struct {
		test     string
		expected string
	}
	testTimes []struct {
		test     time.Duration
		expected string
	}
)

// TestParse for durafmt time.Duration conversion.
func TestParse(t *testing.T) {
	testTimes = []struct {
		test     time.Duration
		expected string
	}{
		{1 * time.Millisecond, "1 millisecond"},
		{1 * time.Second, "1 second"},
		{1 * time.Hour, "1 hour"},
		{1 * time.Minute, "1 minute"},
		{2 * time.Millisecond, "2 milliseconds"},
		{2 * time.Second, "2 seconds"},
		{2 * time.Minute, "2 minutes"},
		{1 * time.Hour, "1 hour"},
		{2 * time.Hour, "2 hours"},
		{10 * time.Hour, "10 hours"},
		{24 * time.Hour, "1 day"},
		{48 * time.Hour, "2 days"},
		{120 * time.Hour, "5 days"},
		{168 * time.Hour, "1 week"},
		{672 * time.Hour, "4 weeks"},
		{8759 * time.Hour, "52 weeks 23 hours"},
		{8760 * time.Hour, "1 year"},
		{17519 * time.Hour, "1 year 52 weeks 23 hours"},
		{17520 * time.Hour, "2 years"},
		{26279 * time.Hour, "2 years 52 weeks 23 hours"},
		{26280 * time.Hour, "3 years"},
		{201479 * time.Hour, "22 years 52 weeks 23 hours"},
		{201480 * time.Hour, "23 years"},
		{-1 * time.Second, "-1 second"},
		{-10 * time.Second, "-10 seconds"},
		{-100 * time.Second, "-1 minute 40 seconds"},
		{-1 * time.Millisecond, "-1 millisecond"},
		{-10 * time.Millisecond, "-10 milliseconds"},
		{-100 * time.Millisecond, "-100 milliseconds"},
	}

	for _, table := range testTimes {
		result := Parse(table.test).String()
		if result != table.expected {
			t.Errorf("Parse(%q).String() = %q. got %q, expected %q",
				table.test, result, result, table.expected)
		}
	}
}

// TestParseString for durafmt duration string conversion.
func TestParseString(t *testing.T) {
	testStrings = []struct {
		test     string
		expected string
	}{
		{"1ms", "1 millisecond"},
		{"2ms", "2 milliseconds"},
		{"1s", "1 second"},
		{"2s", "2 seconds"},
		{"1m", "1 minute"},
		{"2m", "2 minutes"},
		{"1h", "1 hour"},
		{"2h", "2 hours"},
		{"10h", "10 hours"},
		{"24h", "1 day"},
		{"48h", "2 days"},
		{"120h", "5 days"},
		{"168h", "1 week"},
		{"672h", "4 weeks"},
		{"8759h", "52 weeks 23 hours"},
		{"8760h", "1 year"},
		{"17519h", "1 year 52 weeks 23 hours"},
		{"17520h", "2 years"},
		{"26279h", "2 years 52 weeks 23 hours"},
		{"26280h", "3 years"},
		{"201479h", "22 years 52 weeks 23 hours"},
		{"201480h", "23 years"},
		{"1m0s", "1 minute"},
		{"1m2s", "1 minute 2 seconds"},
		{"3h4m5s", "3 hours 4 minutes 5 seconds"},
		{"6h7m8s9ms", "6 hours 7 minutes 8 seconds 9 milliseconds"},
		{"0ms", "0 milliseconds"},
		{"0s", "0 seconds"},
		{"0m", "0 minutes"},
		{"0h", "0 hours"},
		{"0m1ms", "1 millisecond"},
		{"0m1s", "1 second"},
		{"0m1m", "1 minute"},
		{"0m2ms", "2 milliseconds"},
		{"0m2s", "2 seconds"},
		{"0m2m", "2 minutes"},
		{"0m2m3h", "3 hours 2 minutes"},
		{"0m2m34h", "1 day 10 hours 2 minutes"},
		{"0m56h7m8ms", "2 days 8 hours 7 minutes 8 milliseconds"},
		{"-1ms", "-1 millisecond"},
		{"-1s", "-1 second"},
		{"-1m", "-1 minute"},
		{"-1h", "-1 hour"},
		{"-2ms", "-2 milliseconds"},
		{"-2s", "-2 seconds"},
		{"-2m", "-2 minutes"},
		{"-2h", "-2 hours"},
		{"-10h", "-10 hours"},
		{"-24h", "-1 day"},
		{"-48h", "-2 days"},
		{"-120h", "-5 days"},
		{"-168h", "-1 week"},
		{"-672h", "-4 weeks"},
		{"-8760h", "-1 year"},
		{"-1m0s", "-1 minute"},
		{"-0m2s", "-2 seconds"},
		{"-0m2m", "-2 minutes"},
		{"-0m2m3h", "-3 hours 2 minutes"},
		{"-0m2m34h", "-1 day 10 hours 2 minutes"},
		{"-0ms", "-0 milliseconds"},
		{"-0s", "-0 seconds"},
		{"-0m", "-0 minutes"},
		{"-0h", "-0 hours"},
	}

	for _, table := range testStrings {
		d, err := ParseString(table.test)
		if err != nil {
			t.Errorf("%q", err)
		}
		result := d.String()
		if result != table.expected {
			t.Errorf("d.String() = %q. got %q, expected %q",
				table.test, result, table.expected)
		}
	}
}

// TestInvalidDuration for invalid inputs.
func TestInvalidDuration(t *testing.T) {
	testStrings = []struct {
		test     string
		expected string
	}{
		{"1", ""},
		{"1d", ""},
		{"1w", ""},
		{"1wk", ""},
		{"1y", ""},
		{"", ""},
		{"m1", ""},
		{"1nmd", ""},
		{"0", ""},
		{"-0", ""},
	}

	for _, table := range testStrings {
		_, err := ParseString(table.test)
		if err == nil {
			t.Errorf("ParseString(%q). got %q, expected %q",
				table.test, err, table.expected)
		}
	}
}
