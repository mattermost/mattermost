package searchlayer

import "strings"

func sanitizeSearchTerm(term string) string {
	return strings.TrimLeft(term, "@")
}