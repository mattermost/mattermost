// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"crypto/sha256"
	"encoding/base64"
)

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// getCacheTargets is used to fill target value types
// for getting items from cache.
func getCacheTargets[T any](l int) []any {
       toPass := make([]any, 0, l)
       for i := 0; i < l; i++ {
               var target T
               toPass = append(toPass, &target)
       }
       return toPass
}
