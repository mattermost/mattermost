// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import "github.com/mattermost/mattermost-server/server/public/shared/mlog"

// Meta represents metadata that can be added to a audit record as name/value pairs.
type Meta struct {
	K string
	V interface{}
}

// FuncMetaTypeConv defines a function that can convert meta data types into something
// that serializes well for audit records.
type FuncMetaTypeConv func(val interface{}) (newVal interface{}, converted bool)

// Record provides a consistent set of fields used for all audit logging.
type Record struct {
	APIPath   string
	Event     string
	Status    string
	UserID    string
	SessionID string
	Client    string
	IPAddress string
	Meta      []Meta
	metaConv  []FuncMetaTypeConv
}

// Success marks the audit record status as successful.
func (rec *Record) Success() {
	rec.Status = Success
}

// Success marks the audit record status as failed.
func (rec *Record) Fail() {
	rec.Status = Fail
}

// AddMeta adds a single name/value pair to this audit record's metadata.
func (rec *Record) AddMeta(name string, val interface{}) {
	if rec.Meta == nil {
		rec.Meta = []Meta{}
	}

	// possibly convert val to something better suited for serializing
	// via zero or more conversion functions.
	for _, conv := range rec.metaConv {
		converted, wasConverted := conv(val)
		if wasConverted {
			val = converted
			break
		}
	}

	lc, ok := val.(mlog.LogCloner)
	if ok {
		val = lc.LogClone()
	}

	rec.Meta = append(rec.Meta, Meta{K: name, V: val})
}

// AddMetaTypeConverter adds a function capable of converting meta field types
// into something more suitable for serialization.
func (rec *Record) AddMetaTypeConverter(f FuncMetaTypeConv) {
	rec.metaConv = append(rec.metaConv, f)
}
