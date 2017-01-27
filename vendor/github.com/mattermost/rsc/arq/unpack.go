// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Parsing of Arq's binary data structures.

package arq

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"reflect"
	"time"
)

var errMalformed = fmt.Errorf("malformed data")
var tagType = reflect.TypeOf(tag(""))
var timeType = reflect.TypeOf(time.Time{})
var scoreType = reflect.TypeOf(score{})

func unpack(data []byte, v interface{}) error {
	data, err := unpackValue(data, reflect.ValueOf(v).Elem(), "")
	if err != nil {
		return err
	}
	if len(data) != 0 {
		if len(data) > 100 {
			return fmt.Errorf("more data than expected: %x...", data[:100])
		}
		return fmt.Errorf("more data than expected: %x", data)
	}
	return nil
}

func unpackValue(data []byte, v reflect.Value, tag string) ([]byte, error) {
	//println("unpackvalue", v.Type().String(), len(data))
	switch v.Kind() {
	case reflect.String:
		if v.Type() == tagType {
			if tag == "" {
				panic("arqfs: missing reflect tag on Tag field")
			}
			if len(data) < len(tag) || !bytes.Equal(data[:len(tag)], []byte(tag)) {
				return nil, errMalformed
			}
			data = data[len(tag):]
			return data, nil
		}
		if len(data) < 1 {
			return nil, errMalformed
		}
		if data[0] == 0 {
			data = data[1:]
			v.SetString("")
			return data, nil
		}
		if data[0] != 1 || len(data) < 1+8 {
			return nil, errMalformed
		}
		n := binary.BigEndian.Uint64(data[1:])
		data = data[1+8:]
		if n >= uint64(len(data)) {
			return nil, errMalformed
		}
		str := data[:n]
		data = data[n:]
		v.SetString(string(str))
		return data, nil

	case reflect.Uint32:
		if len(data) < 4 {
			return nil, errMalformed
		}
		v.SetUint(uint64(binary.BigEndian.Uint32(data)))
		data = data[4:]
		return data, nil

	case reflect.Int32:
		if len(data) < 4 {
			return nil, errMalformed
		}
		v.SetInt(int64(binary.BigEndian.Uint32(data)))
		data = data[4:]
		return data, nil

	case reflect.Uint8:
		if len(data) < 1 {
			return nil, errMalformed
		}
		v.SetUint(uint64(data[0]))
		data = data[1:]
		return data, nil

	case reflect.Uint64:
		if len(data) < 8 {
			return nil, errMalformed
		}
		v.SetUint(binary.BigEndian.Uint64(data))
		data = data[8:]
		return data, nil

	case reflect.Int64:
		if len(data) < 8 {
			return nil, errMalformed
		}
		v.SetInt(int64(binary.BigEndian.Uint64(data)))
		data = data[8:]
		return data, nil

	case reflect.Ptr:
		v.Set(reflect.New(v.Type().Elem()))
		return unpackValue(data, v.Elem(), tag)

	case reflect.Slice:
		var n int
		if tag == "count32" {
			n32 := binary.BigEndian.Uint32(data)
			n = int(n32)
			if uint32(n) != n32 {
				return nil, errMalformed
			}
			data = data[4:]
		} else {
			if len(data) < 8 {
				return nil, errMalformed
			}
			n64 := binary.BigEndian.Uint64(data)
			n = int(n64)
			if uint64(n) != n64 {
				return nil, errMalformed
			}
			data = data[8:]
		}
		v.Set(v.Slice(0, 0))
		if v.Type().Elem().Kind() == reflect.Uint8 {
			// Fast case for []byte
			if len(data) < n {
				return nil, errMalformed
			}
			v.Set(reflect.AppendSlice(v, reflect.ValueOf(data[:n])))
			return data[n:], nil
		}
		for i := 0; i < n; i++ {
			elem := reflect.New(v.Type().Elem()).Elem()
			var err error
			data, err = unpackValue(data, elem, "")
			if err != nil {
				return nil, err
			}
			v.Set(reflect.Append(v, elem))
		}
		return data, nil

	case reflect.Array:
		if v.Type() == scoreType && tag == "HexScore" {
			var s string
			data, err := unpackValue(data, reflect.ValueOf(&s).Elem(), "")
			if err != nil {
				return nil, err
			}
			if len(s) != 0 {
				v.Set(reflect.ValueOf(hexScore(s)))
			}
			return data, nil
		}
		n := v.Len()
		if v.Type().Elem().Kind() == reflect.Uint8 {
			// Fast case for [n]byte
			if len(data) < n {
				return nil, errMalformed
			}
			reflect.Copy(v, reflect.ValueOf(data))
			data = data[n:]
			return data, nil
		}
		for i := 0; i < n; i++ {
			var err error
			data, err = unpackValue(data, v.Index(i), "")
			if err != nil {
				return nil, err
			}
		}
		return data, nil

	case reflect.Bool:
		if len(data) < 1 || data[0] > 1 {
			if len(data) >= 1 {
				println("badbool", data[0])
			}
			return nil, errMalformed
		}
		v.SetBool(data[0] == 1)
		data = data[1:]
		return data, nil

	case reflect.Struct:
		if v.Type() == timeType {
			if len(data) < 1 || data[0] > 1 {
				return nil, errMalformed
			}
			if data[0] == 0 {
				v.Set(reflect.ValueOf(time.Time{}))
				return data[1:], nil
			}
			data = data[1:]
			if len(data) < 8 {
				return nil, errMalformed
			}
			ms := binary.BigEndian.Uint64(data)
			v.Set(reflect.ValueOf(time.Unix(int64(ms/1e3), int64(ms%1e3)*1e6)))
			return data[8:], nil
		}
		for i := 0; i < v.NumField(); i++ {
			f := v.Type().Field(i)
			fv := v.Field(i)
			var err error
			data, err = unpackValue(data, fv, f.Tag.Get("arq"))
			if err != nil {
				return nil, err
			}
		}
		return data, nil
	}

	panic("arqfs: unexpected type in unpackValue: " + v.Type().String())
}
