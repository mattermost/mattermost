// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package log

import (
	"testing"

	"github.com/mattermost/platform/model"
)

const (
	DEFAULT_LOCATION = "./mattermost.log"
)

func TestLogDebug(t *testing.T) {
	Open(DEFAULT_LOCATION)
	SetLocale("en")
	Debug("log_test.debug")
	Debug("log_test.debug_param", "test")
	Close()
}

func TestLogInfo(t *testing.T) {
	Open(DEFAULT_LOCATION)
	SetLocale("en")
	Info("log_test.info")
	Info("log_test.info_param", "test")
	Close()
}

func TestLogWarn(t *testing.T) {
	Open(DEFAULT_LOCATION)
	SetLocale("en")
	Warn("log_test.warn")
	Warn("log_test.warn_param", "test")
	Close()
}

func TestLogError(t *testing.T) {
	Open(DEFAULT_LOCATION)
	SetLocale("en")
	err1 := model.NewLocAppError("log.test", "log_test.error", nil, "")
	Error(err1)

	err2 := model.NewLocAppError("log.test", "log_test.error_param", map[string]interface{}{
		"test": "abc",
	}, "this should print")
	Error(err2)
	Close()
}

func TestLogErrorf(t *testing.T) {
	Open(DEFAULT_LOCATION)
	SetLocale("en")
	Errorf("This is a raw string")
	Errorf("This is a string with %s and %s", "hello", "happy")
	Close()
}
