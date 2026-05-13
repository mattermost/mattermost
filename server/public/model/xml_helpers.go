// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"sort"
)

// xmlStringMapEntry is the XML representation of a single StringMap entry.
type xmlStringMapEntry struct {
	Key   string `xml:"key,attr"`
	Value string `xml:"value,attr"`
}

// MarshalXML encodes a StringMap as a sequence of <Entry key="..." value="..."/> elements.
func (m StringMap) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	if m == nil {
		return e.EncodeElement(struct{}{}, start)
	}

	if err := e.EncodeToken(start); err != nil {
		return err
	}

	// Sort keys for deterministic output.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		entry := xmlStringMapEntry{Key: k, Value: m[k]}
		if err := e.EncodeElement(entry, xml.StartElement{Name: xml.Name{Local: "Entry"}}); err != nil {
			return err
		}
	}

	return e.EncodeToken(start.End())
}

// UnmarshalXML decodes a sequence of <Entry key="..." value="..."/> elements into a StringMap.
func (m *StringMap) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	*m = make(StringMap)

	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "Entry" {
				var entry xmlStringMapEntry
				if err := d.DecodeElement(&entry, &t); err != nil {
					return err
				}
				(*m)[entry.Key] = entry.Value
			} else {
				if err := d.Skip(); err != nil {
					return err
				}
			}
		case xml.EndElement:
			return nil
		}
	}
}

// xmlStringInterfaceEntry is the XML representation of a single StringInterface entry.
// Values are stored as strings. Non-string values are JSON-encoded.
type xmlStringInterfaceEntry struct {
	Key      string `xml:"key,attr"`
	Value    string `xml:"value,attr"`
	JSONType string `xml:"type,attr,omitempty"` // "json" when the value is JSON-encoded
}

// MarshalXML encodes a StringInterface as a sequence of <Entry> elements.
// String values are stored directly. Other types are JSON-encoded with type="json".
func (m StringInterface) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	if m == nil {
		return e.EncodeElement(struct{}{}, start)
	}

	if err := e.EncodeToken(start); err != nil {
		return err
	}

	// Sort keys for deterministic output.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		v := m[k]
		entry := xmlStringInterfaceEntry{Key: k}

		switch val := v.(type) {
		case string:
			entry.Value = val
		case nil:
			entry.JSONType = "json"
			entry.Value = "null"
		default:
			b, err := json.Marshal(val)
			if err != nil {
				return fmt.Errorf("failed to marshal StringInterface value for key %q: %w", k, err)
			}
			entry.JSONType = "json"
			entry.Value = string(b)
		}

		if err := e.EncodeElement(entry, xml.StartElement{Name: xml.Name{Local: "Entry"}}); err != nil {
			return err
		}
	}

	return e.EncodeToken(start.End())
}

// UnmarshalXML decodes a sequence of <Entry> elements into a StringInterface.
// Entries with type="json" have their values JSON-decoded.
func (m *StringInterface) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	*m = make(StringInterface)

	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}

		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "Entry" {
				var entry xmlStringInterfaceEntry
				if err := d.DecodeElement(&entry, &t); err != nil {
					return err
				}
				if entry.JSONType == "json" {
					var v any
					if err := json.Unmarshal([]byte(entry.Value), &v); err != nil {
						return fmt.Errorf("failed to unmarshal StringInterface JSON value for key %q: %w", entry.Key, err)
					}
					(*m)[entry.Key] = v
				} else {
					(*m)[entry.Key] = entry.Value
				}
			} else {
				if err := d.Skip(); err != nil {
					return err
				}
			}
		case xml.EndElement:
			return nil
		}
	}
}
