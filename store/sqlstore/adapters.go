// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/pkg/errors"
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
			out.WriteByte(',')
		}
	}

	if err := out.WriteByte(']'); err != nil {
		return nil, err
	}
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

func (t *TraceOnAdapter) Printf(format string, v ...interface{}) {
	originalString := fmt.Sprintf(format, v...)
	newString := strings.ReplaceAll(originalString, "\n", " ")
	newString = strings.ReplaceAll(newString, "\t", " ")
	newString = strings.ReplaceAll(newString, "\"", "")
	mlog.Debug(newString)
}

type JSONSerializable interface {
	ToJSON() string
}

type mattermConverter struct{}

func (me mattermConverter) ToDb(val interface{}) (interface{}, error) {
	switch t := val.(type) {
	case model.StringMap:
		return model.MapToJSON(t), nil
	case map[string]string:
		return model.MapToJSON(model.StringMap(t)), nil
	case model.StringArray:
		return model.ArrayToJSON(t), nil
	case model.StringInterface:
		return model.StringInterfaceToJSON(t), nil
	case map[string]interface{}:
		return model.StringInterfaceToJSON(model.StringInterface(t)), nil
	case JSONSerializable:
		return t.ToJSON(), nil
	case *opengraph.OpenGraph:
		return json.Marshal(t)
	case *model.PostImage:
		return json.Marshal(t)
	}

	return val, nil
}

func (me mattermConverter) FromDb(target interface{}) (gorp.CustomScanner, bool) {
	switch target.(type) {
	case *model.StringMap:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(i18n.T("store.sql.convert_string_map"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *map[string]string:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(i18n.T("store.sql.convert_string_map"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *model.StringArray:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(i18n.T("store.sql.convert_string_array"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *model.StringInterface:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(i18n.T("store.sql.convert_string_interface"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *map[string]interface{}:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(i18n.T("store.sql.convert_string_interface"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	}

	return gorp.CustomScanner{}, false
}
