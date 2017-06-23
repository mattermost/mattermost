// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package number

import (
	"fmt"
	"log"
	"strings"
	"testing"

	"golang.org/x/text/language"
)

func TestAppendDecimal(t *testing.T) {
	type pairs map[string]string // alternates with decimal input and result

	testCases := []struct {
		pattern string
		// We want to be able to test some forms of patterns that cannot be
		// represented as a string.
		pat *Pattern

		test pairs
	}{{
		pattern: "0",
		test: pairs{
			"0":    "0",
			"1":    "1",
			"-1":   "-1",
			".00":  "0",
			"10.":  "10",
			"12":   "12",
			"1.2":  "1",
			"NaN":  "NaN",
			"-Inf": "-∞",
		},
	}, {
		pattern: "+0",
		test: pairs{
			"0":    "+0",
			"1":    "+1",
			"-1":   "-1",
			".00":  "+0",
			"10.":  "+10",
			"12":   "+12",
			"1.2":  "+1",
			"NaN":  "NaN",
			"-Inf": "-∞",
		},
	}, {
		pattern: "0 +",
		test: pairs{
			"0":   "0 +",
			"1":   "1 +",
			"-1":  "1 -",
			".00": "0 +",
		},
	}, {
		pattern: "0;0-",
		test: pairs{
			"-1": "1-",
		},
	}, {
		pattern: "0000",
		test: pairs{
			"0":     "0000",
			"1":     "0001",
			"12":    "0012",
			"12345": "12345",
		},
	}, {
		pattern: ".0",
		test: pairs{
			"0":      ".0",
			"1":      "1.0",
			"1.2":    "1.2",
			"1.2345": "1.2",
		},
	}, {
		pattern: "#.0",
		test: pairs{
			"0": ".0",
		},
	}, {
		pattern: "#.0#",
		test: pairs{
			"0": ".0",
			"1": "1.0",
		},
	}, {
		pattern: "0.0#",
		test: pairs{
			"0": "0.0",
		},
	}, {
		pattern: "#0.###",
		test: pairs{
			"0":        "0",
			"1":        "1",
			"1.2":      "1.2",
			"1.2345":   "1.234", // rounding should have been done earlier
			"1234.5":   "1234.5",
			"1234.567": "1234.567",
		},
	}, {
		pattern: "#0.######",
		test: pairs{
			"0":           "0",
			"1234.5678":   "1234.5678",
			"0.123456789": "0.123456",
			"NaN":         "NaN",
			"Inf":         "∞",
		},

		// Test separators.
	}, {
		pattern: "#,#.00",
		test: pairs{
			"100": "1,0,0.00",
		},
	}, {
		pattern: "#,0.##",
		test: pairs{
			"10": "1,0",
		},
	}, {
		pattern: "#,0",
		test: pairs{
			"10": "1,0",
		},
	}, {
		pattern: "#,##,#.00",
		test: pairs{
			"1000": "1,00,0.00",
		},
	}, {
		pattern: "#,##0.###",
		test: pairs{
			"0":           "0",
			"1234.5678":   "1,234.567",
			"0.123456789": "0.123",
		},
	}, {
		pattern: "#,##,##0.###",
		test: pairs{
			"0":            "0",
			"123456789012": "1,23,45,67,89,012",
			"0.123456789":  "0.123",
		},

		// Support for ill-formed patterns.
	}, {
		pattern: "#",
		test: pairs{
			".00": "0",
			"0":   "0",
			"1":   "1",
			"10.": "10",
		},
	}, {
		pattern: ".#",
		test: pairs{
			"0":      "0",
			"1":      "1",
			"1.2":    "1.2",
			"1.2345": "1.2",
		},
	}, {
		pattern: "#,#.##",
		test: pairs{
			"10": "1,0",
		},
	}, {
		pattern: "#,#",
		test: pairs{
			"10": "1,0",
		},

		// Special patterns
	}, {
		pattern: "#,max_int=2",
		pat: &Pattern{
			MaxIntegerDigits: 2,
		},
		test: pairs{
			"2017": "17",
		},
	}, {
		pattern: "0,max_int=2",
		pat: &Pattern{
			MaxIntegerDigits: 2,
			MinIntegerDigits: 1,
		},
		test: pairs{
			"2000": "0",
			"2001": "1",
			"2017": "17",
		},
	}, {
		pattern: "00,max_int=2",
		pat: &Pattern{
			MaxIntegerDigits: 2,
			MinIntegerDigits: 2,
		},
		test: pairs{
			"2000": "00",
			"2001": "01",
			"2017": "17",
		},
	}, {
		pattern: "@@@@,max_int=2",
		pat: &Pattern{
			MaxIntegerDigits:     2,
			MinSignificantDigits: 4,
		},
		test: pairs{
			"2017": "17.00",
			"2000": "0.000",
			"2001": "1.000",
		},

		// Significant digits
	}, {
		pattern: "@@##",
		test: pairs{
			"1":     "1.0",
			"0.1":   "0.10",
			"123":   "123",
			"1234":  "1234",
			"12345": "12340",
		},
	}, {
		pattern: "@@@@",
		test: pairs{
			"1":     "1.000",
			".1":    "0.1000",
			".001":  "0.001000",
			"123":   "123.0",
			"1234":  "1234",
			"12345": "12340", // rounding down
			"NaN":   "NaN",
			"-Inf":  "-∞",
		},

		// TODO: rounding
		// {"@@@@": "23456": "23460"}, // rounding up
		// TODO: padding

		// Scientific and Engineering notation
	}, {
		pattern: "#E0",
		test: pairs{
			"0":       "0E0",
			"1":       "1E0",
			"123.456": "1E2",
		},
	}, {
		pattern: "#E+0",
		test: pairs{
			"0":      "0E+0",
			"1000":   "1E+3",
			"1E100":  "1E+100",
			"1E-100": "1E-100",
			"NaN":    "NaN",
			"-Inf":   "-∞",
		},
	}, {
		pattern: "##0E00",
		test: pairs{
			"100":     "100E00",
			"12345":   "10E03",
			"123.456": "100E00",
		},
	}, {
		pattern: "##0.###E00",
		test: pairs{
			"100":     "100E00",
			"12345":   "12.34E03",
			"123.456": "123.4E00",
		},
	}, {
		pattern: "##0.000E00",
		test: pairs{
			"100":     "100.0E00",
			"12345":   "12.34E03",
			"123.456": "123.4E00",
		},
	}}

	// TODO:
	// 	"@@E0",
	// 	"@###E00",
	// 	"0.0%",
	// 	"0.0‰",
	// 	"#,##0.00¤",
	// 	"#,##0.00 ¤;(#,##0.00 ¤)",
	// 	// padding
	// 	"*x#",
	// 	"#*x",
	// 	"*xpre#suf",
	// 	"pre*x#suf",
	// 	"pre#*xsuf",
	// 	"pre#suf*x",
	for _, tc := range testCases {
		pat := tc.pat
		if pat == nil {
			var err error
			if pat, err = ParsePattern(tc.pattern); err != nil {
				log.Fatal(err)
			}
		}
		f := &Formatter{
			pat,
			InfoFromTag(language.English),
			RoundingContext{},
			appendDecimal,
		}
		if strings.IndexByte(tc.pattern, 'E') != -1 {
			f.f = appendScientific
		}
		for dec, want := range tc.test {
			buf := make([]byte, 100)
			t.Run(tc.pattern+"/"+dec, func(t *testing.T) {
				dec := mkdec(dec)
				buf = f.Format(buf[:0], &dec)
				if got := string(buf); got != want {
					t.Errorf("\n got %q\nwant %q", got, want)
				}
			})
		}
	}
}

func TestLocales(t *testing.T) {
	testCases := []struct {
		tag  language.Tag
		num  string
		want string
	}{
		{language.Make("en"), "123456.78", "123,456.78"},
		{language.Make("de"), "123456.78", "123.456,78"},
		{language.Make("de-CH"), "123456.78", "123'456.78"},
		{language.Make("fr"), "123456.78", "123 456,78"},
		{language.Make("bn"), "123456.78", "১,২৩,৪৫৬.৭৮"},
	}
	for _, tc := range testCases {
		t.Run(fmt.Sprint(tc.tag, "/", tc.num), func(t *testing.T) {
			f := &Formatter{
				lookupFormat(tc.tag, tagToDecimal),
				InfoFromTag(tc.tag),
				RoundingContext{},
				appendDecimal,
			}
			d := mkdec(tc.num)
			b := f.Format(nil, &d)
			if got := string(b); got != tc.want {
				t.Errorf("got %q; want %q", got, tc.want)
			}
		})
	}
}
