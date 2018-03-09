package model

import "encoding/json"

func TimezonesToJson(timezoneList []string) string {
	b, _ := json.Marshal(timezoneList)
	return string(b)
}

func DefaultUserTimezone() map[string]string {
	defaultTimezone := make(map[string]string)
	defaultTimezone["useAutomaticTimezone"] = "true"
	defaultTimezone["automaticTimezone"] = ""
	defaultTimezone["manualTimezone"] = ""

	return defaultTimezone
}
