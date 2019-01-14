// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/binary"
	"encoding/json"
	"hash/fnv"
	"net/http"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
)

const (
	LINK_METADATA_TYPE_IMAGE     LinkMetadataType = "image"
	LINK_METADATA_TYPE_OPENGRAPH LinkMetadataType = "opengraph"
)

type LinkMetadataType string

// LinkMetadata stores arbitrary data about a link posted in a message. This includes dimensions of linked images
// and OpenGraph metadata.
type LinkMetadata struct {
	// Hash is a value computed from the URL and Timestamp for use as a primary key in the database.
	Hash int64

	URL       string
	Timestamp int64
	Type      LinkMetadataType

	// Data is the actual metadata for the link. It should contain data of one of the following types:
	// - *model.PostImage if the linked content is an image
	// - *opengraph.OpenGraph if the linked content is an HTML document
	Data interface{}
}

func (o *LinkMetadata) PreSave() {
	o.Hash = GenerateLinkMetadataHash(o.URL, o.Timestamp)
}

func (o *LinkMetadata) IsValid() *AppError {
	if o.URL == "" {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.url.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Timestamp == 0 || !isRoundedToNearestHour(o.Timestamp) {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.timestamp.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Data == nil {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data.app_error", nil, "", http.StatusBadRequest)
	}

	switch o.Type {
	case LINK_METADATA_TYPE_IMAGE:
		if _, ok := o.Data.(*PostImage); !ok {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data_type.app_error", nil, "", http.StatusBadRequest)
		}
	case LINK_METADATA_TYPE_OPENGRAPH:
		if _, ok := o.Data.(*opengraph.OpenGraph); !ok {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data_type.app_error", nil, "", http.StatusBadRequest)
		}
	default:
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// FixData converts o.Data from JSON into properly structured data. This is intended to be used after deserializing
// a LinkMetadata object that has been stored in the database.
func (o *LinkMetadata) FixData() error {
	var b []byte
	switch t := o.Data.(type) {
	case []byte:
		// MySQL uses a byte slice for JSON
		b = t
	case string:
		// Postgres uses a string for JSON
		b = []byte(t)
	}

	if b == nil {
		// Data doesn't need to be fixed
		return nil
	}

	var data interface{}
	var err error

	switch o.Type {
	case LINK_METADATA_TYPE_IMAGE:
		image := &PostImage{}

		err = json.Unmarshal(b, &image)

		data = image
	case LINK_METADATA_TYPE_OPENGRAPH:
		og := &opengraph.OpenGraph{}

		json.Unmarshal(b, &og)

		data = og
	}

	if err != nil {
		return err
	}

	o.Data = data

	return nil
}

// FloorToNearestHour takes a timestamp (in milliseconds) and returns it rounded to the previous hour.
func FloorToNearestHour(ms int64) int64 {
	t := time.Unix(0, ms*int64(1000*1000))

	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, t.Location()).UnixNano() / int64(time.Millisecond)
}

// isRoundedToNearestHour returns true if the given timestamp (in milliseconds) has been rounded to the nearest hour.
func isRoundedToNearestHour(ms int64) bool {
	t := time.Unix(0, ms*int64(1000*1000))

	return t.Minute() == 0 && t.Second() == 0 && t.Nanosecond() == 0
}

// GenerateLinkMetadataHash generates a unique hash for a given URL and timestamp for use as a database key.
func GenerateLinkMetadataHash(url string, timestamp int64) int64 {
	hash := fnv.New32()

	// Note that we ignore write errors here because the Hash interface says that its Write will never return an error
	binary.Write(hash, binary.LittleEndian, timestamp)
	hash.Write([]byte(url))

	return int64(hash.Sum32())
}
