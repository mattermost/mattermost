// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"database/sql/driver"
	"fmt"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type jsonArray []string

func (a jsonArray) Value() (driver.Value, error) {
	var out bytes.Buffer
	_ = out.WriteByte('[')

	for i, item := range a {
		_, _ = out.WriteString(strconv.Quote(item))

		// Skip the last element.
		if i < len(a)-1 {
			_ = out.WriteByte(',')
		}
	}

	_ = out.WriteByte(']')
	return out.Bytes(), nil
}

type jsonStringVal string

func (str jsonStringVal) Value() (driver.Value, error) {
	return strconv.Quote(string(str)), nil
}

type jsonKeyPath string

func (str jsonKeyPath) Value() (driver.Value, error) {
	return "{" + string(str) + "}", nil
}

type TraceOnAdapter struct{}

func (t *TraceOnAdapter) Printf(format string, v ...any) {
	originalString := fmt.Sprintf(format, v...)
	newString := strings.ReplaceAll(originalString, "\n", " ")
	newString = strings.ReplaceAll(newString, "\t", " ")
	newString = strings.ReplaceAll(newString, "\"", "")
	mlog.Debug(newString)
}

type JSONSerializable interface {
	ToJSON() string
}
