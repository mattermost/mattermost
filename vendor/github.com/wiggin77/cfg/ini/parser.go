package ini

import (
	"fmt"
	"strings"

	"github.com/wiggin77/merror"
)

// LF is linefeed
const LF byte = 0x0A

// CR is carriage return
const CR byte = 0x0D

// getSections parses an INI formatted string, or string containing just name/value pairs,
// returns map of `Section`'s.
//
// Any name/value pairs appearing before a section name are added to the section named
// with an empty string ("").  Also true for Linux-style config files where all props
// are outside a named section.
//
// Any errors encountered are aggregated and returned, along with the partially parsed
// sections.
func getSections(str string) (map[string]*Section, error) {
	merr := merror.New()
	mapSections := make(map[string]*Section)
	lines := buildLineArray(str)
	section := newSection("")

	for _, line := range lines {
		name, ok := parseSection(line)
		if ok {
			// A section name encountered. Stop processing the current one.
			// Don't add the current section to the map if the section name is blank
			// and the prop map is empty.
			nameCurr := section.GetName()
			if nameCurr != "" || section.hasKeys() {
				mapSections[nameCurr] = section
			}
			// Start processing a new section.
			section = newSection(name)
		} else {
			// Parse the property and add to the current section, or ignore if comment.
			if k, v, comment, err := parseProp(line); !comment && err == nil {
				section.setProp(k, v)
			} else if err != nil {
				merr.Append(err) // aggregate errors
			}
		}

	}
	// If the current section is not empty, add it.
	if section.hasKeys() {
		mapSections[section.GetName()] = section
	}
	return mapSections, merr.ErrorOrNil()
}

// buildLineArray parses the given string buffer and creates a list of strings,
// one for each line in the string buffer.
//
// A line is considered to be terminated by any one of a line feed ('\n'),
// a carriage return ('\r'), or a carriage return followed immediately by a
// linefeed.
//
// Lines prefixed with ';' or '#' are considered comments and skipped.
func buildLineArray(str string) []string {
	arr := make([]string, 0, 10)
	str = str + "\n"

	iLen := len(str)
	iPos, iBegin := 0, 0
	var ch byte

	for iPos < iLen {
		ch = str[iPos]
		if ch == LF || ch == CR {
			sub := str[iBegin:iPos]
			sub = strings.TrimSpace(sub)
			if sub != "" && !strings.HasPrefix(sub, ";") && !strings.HasPrefix(sub, "#") {
				arr = append(arr, sub)
			}
			iPos++
			if ch == CR && iPos < iLen && str[iPos] == LF {
				iPos++
			}
			iBegin = iPos
		} else {
			iPos++
		}
	}
	return arr
}

// parseSection parses the specified string for a section name enclosed in square brackets.
// Returns the section name found, or `ok=false` if `str` is not a section header.
func parseSection(str string) (name string, ok bool) {
	str = strings.TrimSpace(str)
	if !strings.HasPrefix(str, "[") {
		return "", false
	}
	iCloser := strings.Index(str, "]")
	if iCloser == -1 {
		return "", false
	}
	return strings.TrimSpace(str[1:iCloser]), true
}

// parseProp parses the specified string and extracts a key/value pair.
//
// If the string is a comment (prefixed with ';' or '#') then `comment=true`
// and key will be empty.
func parseProp(str string) (key string, val string, comment bool, err error) {
	iLen := len(str)
	iEqPos := strings.Index(str, "=")
	if iEqPos == -1 {
		return "", "", false, fmt.Errorf("not a key/value pair:'%s'", str)
	}

	key = str[0:iEqPos]
	key = strings.TrimSpace(key)
	if iEqPos+1 < iLen {
		val = str[iEqPos+1:]
		val = strings.TrimSpace(val)
	}

	// Check that the key has at least 1 char.
	if key == "" {
		return "", "", false, fmt.Errorf("key is empty for '%s'", str)
	}

	// Check if this line is a comment that just happens
	// to have an equals sign in it. Not an error, but not a
	// useable line either.
	if strings.HasPrefix(key, ";") || strings.HasPrefix(key, "#") {
		key = ""
		val = ""
		comment = true
	}
	return key, val, comment, err
}
