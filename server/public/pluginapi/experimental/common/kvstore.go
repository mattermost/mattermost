package common

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/pluginapi"
)

var ErrNotFound = errors.New("not found")

type KVStore interface {
	Set(key string, value any, options ...pluginapi.KVSetOption) (bool, error)
	Get(key string, o any) error
	Delete(key string) error
	DeleteAll() error
	ListKeys(page, count int, options ...pluginapi.ListKeysOption) ([]string, error)
}
