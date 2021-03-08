package common

// StringValueOrDefault returns original value if not empty. Default otherwise.
func StringValueOrDefault(str string, def string) string {
	if str != "" {
		return str
	}
	return def
}
