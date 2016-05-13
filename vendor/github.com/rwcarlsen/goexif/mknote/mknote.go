// Package mknote provides makernote parsers that can be used with goexif/exif.
package mknote

import (
	"bytes"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/tiff"
)

var (
	// Canon is an exif.Parser for canon makernote data.
	Canon = &canon{}
	// NikonV3 is an exif.Parser for nikon makernote data.
	NikonV3 = &nikonV3{}
	// All is a list of all available makernote parsers
	All = []exif.Parser{Canon, NikonV3}
)

type canon struct{}

// Parse decodes all Canon makernote data found in x and adds it to x.
func (_ *canon) Parse(x *exif.Exif) error {
	m, err := x.Get(exif.MakerNote)
	if err != nil {
		return nil
	}

	mk, err := x.Get(exif.Make)
	if err != nil {
		return nil
	}

	if val, err := mk.StringVal(); err != nil || val != "Canon" {
		return nil
	}

	// Canon notes are a single IFD directory with no header.
	// Reader offsets need to be w.r.t. the original tiff structure.
	buf := bytes.NewReader(append(make([]byte, m.ValOffset), m.Val...))
	buf.Seek(int64(m.ValOffset), 0)

	mkNotesDir, _, err := tiff.DecodeDir(buf, x.Tiff.Order)
	if err != nil {
		return err
	}
	x.LoadTags(mkNotesDir, makerNoteCanonFields, false)
	return nil
}

type nikonV3 struct{}

// Parse decodes all Nikon makernote data found in x and adds it to x.
func (_ *nikonV3) Parse(x *exif.Exif) error {
	m, err := x.Get(exif.MakerNote)
	if err != nil {
		return nil
	} else if bytes.Compare(m.Val[:6], []byte("Nikon\000")) != 0 {
		return nil
	}

	// Nikon v3 maker note is a self-contained IFD (offsets are relative
	// to the start of the maker note)
	mkNotes, err := tiff.Decode(bytes.NewReader(m.Val[10:]))
	if err != nil {
		return err
	}
	x.LoadTags(mkNotes.Dirs[0], makerNoteNikon3Fields, false)
	return nil
}
