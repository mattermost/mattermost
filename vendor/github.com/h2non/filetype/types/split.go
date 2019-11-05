package types

import "strings"

func splitMime(s string) (string, string) {
	x := strings.Split(s, "/")
	if len(x) > 1 {
		return x[0], x[1]
	}
	return x[0], ""
}
