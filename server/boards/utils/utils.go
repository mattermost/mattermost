// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"encoding/json"
	"path"
	"reflect"
	"time"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

type IDType byte

const (
	IDTypeNone       IDType = '7'
	IDTypeTeam       IDType = 't'
	IDTypeBoard      IDType = 'b'
	IDTypeCard       IDType = 'c'
	IDTypeView       IDType = 'v'
	IDTypeSession    IDType = 's'
	IDTypeUser       IDType = 'u'
	IDTypeToken      IDType = 'k'
	IDTypeBlock      IDType = 'a'
	IDTypeAttachment IDType = 'i'
)

// NewId is a globally unique identifier.  It is a [A-Z0-9] string 27
// characters long.  It is a UUID version 4 Guid that is zbased32 encoded
// with the padding stripped off, and a one character alpha prefix indicating the
// type of entity or a `7` if unknown type.
func NewID(idType IDType) string {
	return string(idType) + mm_model.NewId()
}

// GetMillis is a convenience method to get milliseconds since epoch.
func GetMillis() int64 {
	return mm_model.GetMillis()
}

// GetMillisForTime is a convenience method to get milliseconds since epoch for provided Time.
func GetMillisForTime(thisTime time.Time) int64 {
	return mm_model.GetMillisForTime(thisTime)
}

// GetTimeForMillis is a convenience method to get time.Time for milliseconds since epoch.
func GetTimeForMillis(millis int64) time.Time {
	return mm_model.GetTimeForMillis(millis)
}

// SecondsToMillis is a convenience method to convert seconds to milliseconds.
func SecondsToMillis(seconds int64) int64 {
	return seconds * 1000
}

func StructToMap(v interface{}) (m map[string]interface{}) {
	b, _ := json.Marshal(v)
	_ = json.Unmarshal(b, &m)
	return
}

func intersection(a []interface{}, b []interface{}) []interface{} {
	set := make([]interface{}, 0)
	hash := make(map[interface{}]bool)
	av := reflect.ValueOf(a)
	bv := reflect.ValueOf(b)

	for i := 0; i < av.Len(); i++ {
		el := av.Index(i).Interface()
		hash[el] = true
	}

	for i := 0; i < bv.Len(); i++ {
		el := bv.Index(i).Interface()
		if _, found := hash[el]; found {
			set = append(set, el)
		}
	}

	return set
}

func Intersection(x ...[]interface{}) []interface{} {
	if len(x) == 0 {
		return nil
	}

	if len(x) == 1 {
		return x[0]
	}

	result := x[0]
	i := 1
	for i < len(x) {
		result = intersection(result, x[i])
		i++
	}

	return result
}

func IsCloudLicense(license *mm_model.License) bool {
	return license != nil &&
		license.Features != nil &&
		license.Features.Cloud != nil &&
		*license.Features.Cloud
}

func DedupeStringArr(arr []string) []string {
	hashMap := map[string]bool{}

	for _, item := range arr {
		hashMap[item] = true
	}

	dedupedArr := make([]string, len(hashMap))
	i := 0
	for key := range hashMap {
		dedupedArr[i] = key
		i++
	}

	return dedupedArr
}

func GetBaseFilePath() string {
	return path.Join("boards", time.Now().Format("20060102"))
}
