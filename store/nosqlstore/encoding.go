// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstore

import (
	"encoding/binary"
	"fmt"
)

func Encode(args ...interface{}) []byte {
	var buf []byte
	for _, arg := range args {
		switch x := arg.(type) {
		case int:
			buf = append(buf, EncodeInt64(int64(x))...)
		case int64:
			buf = append(buf, EncodeInt64(x)...)
		case string:
			buf = append(buf, []byte(x)...)
		default:
			panic(fmt.Errorf("unsupported type: %T", x))
		}
	}
	return buf
}

func EncodeInt64(n int64) []byte {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(n)+(1<<63))
	return buf
}
