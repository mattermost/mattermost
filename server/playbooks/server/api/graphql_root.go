package api

import (
	"strings"
)

type RootResolver struct {
	RunRootResolver
	PlaybookRootResolver
}

func addToSetmap[T any](setmap map[string]interface{}, name string, value *T) {
	if value != nil {
		setmap[name] = *value
	}
}

func addConcatToSetmap(setmap map[string]interface{}, name string, value *[]string) {
	if value != nil {
		setmap[name] = strings.Join(*value, ",")
	}
}
