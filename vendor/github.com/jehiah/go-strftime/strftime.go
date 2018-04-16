// go implementation of strftime
package strftime

import (
	"strings"
	"time"
)

// taken from time/format.go
var conversion = map[rune]string{
	/*stdLongMonth      */ 'B': "January",
	/*stdMonth          */ 'b': "Jan",
	// stdNumMonth       */ 'm': "1",
	/*stdZeroMonth      */ 'm': "01",
	/*stdLongWeekDay    */ 'A': "Monday",
	/*stdWeekDay        */ 'a': "Mon",
	// stdDay            */ 'd': "2",
	// stdUnderDay       */ 'd': "_2",
	/*stdZeroDay        */ 'd': "02",
	/*stdHour           */ 'H': "15",
	// stdHour12         */ 'I': "3",
	/*stdZeroHour12     */ 'I': "03",
	// stdMinute         */ 'M': "4",
	/*stdZeroMinute     */ 'M': "04",
	// stdSecond         */ 'S': "5",
	/*stdZeroSecond     */ 'S': "05",
	/*stdLongYear       */ 'Y': "2006",
	/*stdYear           */ 'y': "06",
	/*stdPM             */ 'p': "PM",
	// stdpm             */ 'p': "pm",
	/*stdTZ             */ 'Z': "MST",
	// stdISO8601TZ      */ 'z': "Z0700",  // prints Z for UTC
	// stdISO8601ColonTZ */ 'z': "Z07:00", // prints Z for UTC
	/*stdNumTZ          */ 'z': "-0700", // always numeric
	// stdNumShortTZ     */ 'b': "-07",    // always numeric
	// stdNumColonTZ     */ 'b': "-07:00", // always numeric
	/* nonStdMilli		 */ 'L': ".000",
}

// This is an alternative to time.Format because no one knows
// what date 040305 is supposed to create when used as a 'layout' string
// this takes standard strftime format options. For a complete list
// of format options see http://strftime.org/
func Format(format string, t time.Time) string {
	retval := make([]byte, 0, len(format))
	for i, ni := 0, 0; i < len(format); i = ni + 2 {
		ni = strings.IndexByte(format[i:], '%')
		if ni < 0 {
			ni = len(format)
		} else {
			ni += i
		}
		retval = append(retval, []byte(format[i:ni])...)
		if ni+1 < len(format) {
			c := format[ni+1]
			if c == '%' {
				retval = append(retval, '%')
			} else {
				if layoutCmd, ok := conversion[rune(c)]; ok {
					retval = append(retval, []byte(t.Format(layoutCmd))...)
				} else {
					retval = append(retval, '%', c)
				}
			}
		} else {
			if ni < len(format) {
				retval = append(retval, '%')
			}
		}
	}
	return string(retval)
}
