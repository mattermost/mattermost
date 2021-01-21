package logging

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

// ObfuscateAPIKey obfucate part of api key
func ObfuscateAPIKey(apikey string) string {
	obfuscationIndex := 80

	total := len(apikey)
	charsToObfuscate := obfuscationIndex * total / 100
	toShow := (total - charsToObfuscate) / 2

	return strings.Join([]string{apikey[:toShow], apikey[len(apikey)-toShow:]}, "...")
}

// ObfuscateHTTPHeader obfuscates sensitive data into headers
func ObfuscateHTTPHeader(headers http.Header) string {
	var re = regexp.MustCompile(`Authorization:\[Bearer ([0-9|a-z|A-Z|\s]*)\]`)
	var str = fmt.Sprint(headers)
	match := re.FindStringSubmatch(str)

	if len(match) == 2 {
		str = strings.Replace(str, match[1], ObfuscateAPIKey(match[1]), 1)
		return fmt.Sprint("[REQUEST_HEADERS]", str, "[END_REQUEST_HEADERS]")
	}

	return str
}
