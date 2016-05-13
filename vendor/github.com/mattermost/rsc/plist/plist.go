// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package plist implements parsing of Apple plist files.
package plist

import (
	"bytes"
	"fmt"
	"reflect"
	"strconv"
)

func next(data []byte) (skip, tag, rest []byte) {
	i := bytes.IndexByte(data, '<')
	if i < 0 {
		return data, nil, nil
	}
	j := bytes.IndexByte(data[i:], '>')
	if j < 0 {
		return data, nil, nil
	}
	j += i + 1
	return data[:i], data[i:j], data[j:]
}

func Unmarshal(data []byte, v interface{}) error {
	_, tag, data := next(data)
	if !bytes.HasPrefix(tag, []byte("<plist")) {
		return fmt.Errorf("not a plist")
	}

	data, err := unmarshalValue(data, reflect.ValueOf(v))
	if err != nil {
		return err
	}
	_, tag, data = next(data)
	if !bytes.Equal(tag, []byte("</plist>")) {
		return fmt.Errorf("junk on end of plist")
	}
	return nil
}

func unmarshalValue(data []byte, v reflect.Value) (rest []byte, err error) {
	_, tag, data := next(data)
	if tag == nil {
		return nil, fmt.Errorf("unexpected end of data")
	}

	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			v.Set(reflect.New(v.Type().Elem()))
		}
		v = v.Elem()
	}

	switch string(tag) {
	case "<dict>":
		t := v.Type()
		if v.Kind() != reflect.Struct {
			return nil, fmt.Errorf("cannot unmarshal <dict> into non-struct %s", v.Type())
		}
	Dict:
		for {
			_, tag, data = next(data)
			if len(tag) == 0 {
				return nil, fmt.Errorf("eof inside <dict>")
			}
			if string(tag) == "</dict>" {
				break
			}
			if string(tag) != "<key>" {
				return nil, fmt.Errorf("unexpected tag %s inside <dict>", tag)
			}
			var body []byte
			body, tag, data = next(data)
			if len(tag) == 0 {
				return nil, fmt.Errorf("eof inside <dict>")
			}
			if string(tag) != "</key>" {
				return nil, fmt.Errorf("unexpected tag %s inside <dict>", tag)
			}
			name := string(body)
			var i int
			for i = 0; i < t.NumField(); i++ {
				f := t.Field(i)
				if f.Name == name || f.Tag.Get("plist") == name {
					data, err = unmarshalValue(data, v.Field(i))
					continue Dict
				}
			}
			data, err = skipValue(data)
			if err != nil {
				return nil, err
			}
		}
		return data, nil

	case "<array>":
		t := v.Type()
		if v.Kind() != reflect.Slice {
			return nil, fmt.Errorf("cannot unmarshal <array> into non-slice %s", v.Type())
		}
		for {
			_, tag, rest := next(data)
			if len(tag) == 0 {
				return nil, fmt.Errorf("eof inside <array>")
			}
			if string(tag) == "</array>" {
				data = rest
				break
			}
			elem := reflect.New(t.Elem()).Elem()
			data, err = unmarshalValue(data, elem)
			if err != nil {
				return nil, err
			}
			v.Set(reflect.Append(v, elem))
		}
		return data, nil

	case "<string>":
		if v.Kind() != reflect.String {
			return nil, fmt.Errorf("cannot unmarshal <string> into non-string %s", v.Type())
		}
		body, etag, data := next(data)
		if len(etag) == 0 {
			return nil, fmt.Errorf("eof inside <string>")
		}
		if string(etag) != "</string>" {
			return nil, fmt.Errorf("expected </string> but got %s", etag)
		}
		v.SetString(string(body)) // TODO: unescape
		return data, nil

	case "<integer>":
		if v.Kind() != reflect.Int {
			return nil, fmt.Errorf("cannot unmarshal <integer> into non-int %s", v.Type())
		}
		body, etag, data := next(data)
		if len(etag) == 0 {
			return nil, fmt.Errorf("eof inside <integer>")
		}
		if string(etag) != "</integer>" {
			return nil, fmt.Errorf("expected </integer> but got %s", etag)
		}
		i, err := strconv.Atoi(string(body))
		if err != nil {
			return nil, fmt.Errorf("non-integer in <integer> tag: %s", body)
		}
		v.SetInt(int64(i))
		return data, nil
	}
	return nil, fmt.Errorf("unexpected tag %s", tag)
}

func skipValue(data []byte) (rest []byte, err error) {
	n := 0
	for {
		var tag []byte
		_, tag, data = next(data)
		if len(tag) == 0 {
			return nil, fmt.Errorf("unexpected eof")
		}
		if tag[1] == '/' {
			if n == 0 {
				return nil, fmt.Errorf("unexpected closing tag")
			}
			n--
			if n == 0 {
				break
			}
		} else {
			n++
		}
	}
	return data, nil
}
