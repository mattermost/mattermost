// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"database/sql/driver"
	"fmt"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

type jsonArray []string

func (a jsonArray) Value() (driver.Value, error) {
	var out bytes.Buffer
	if err := out.WriteByte('['); err != nil {
		return nil, err
	}

	for i, item := range a {
		if _, err := out.WriteString(strconv.Quote(item)); err != nil {
			return nil, err
		}

		// Skip the last element.
		if i < len(a)-1 {
			if err := out.WriteByte(','); err != nil {
				return nil, err
			}
		}
	}

	err := out.WriteByte(']')
	return out.Bytes(), err
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
