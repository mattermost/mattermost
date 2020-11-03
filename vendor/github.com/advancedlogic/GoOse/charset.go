package goose

import (
	"log"
	"strings"
	"unicode/utf8"

	"golang.org/x/net/html/charset"
	"golang.org/x/text/transform"
)

// NormaliseCharset Overrides/fixes charset names to something we can parse.
// Fixes common mispellings and uses a canonical name for equivalent encodings.
// @see https://encoding.spec.whatwg.org#names-and-labels
func NormaliseCharset(characterSet string) string {
	characterSet = strings.ToUpper(characterSet)
	switch characterSet {
	case "UTF8", "UT-8", "UTR-8", "UFT-8", "UTF8-WITHOUT-BOM", "UTF8_GENERAL_CI":
		return "UTF-8"
	// override Japanese
	// CP943: IBM OS/2 Japanese, superset of Cp932 and Shift-JIS
	case "CP943", "CP943C", "SIFT_JIS", "SHIFT-JIS":
		return "SHIFT_JIS"
	// override Korean
	case "EUC-KR", "MS949", "KSC5601", "WINDOWS-949", "KS_C_5601-1987", "KSC_5601":
		return "UHC"
	// override Thai
	//case "TIS-620", "WINDOWS-874":
	//	return "ISO-8859-11"
	// override latin-2
	case "LATIN2_HUNGARIAN_CI", "LATIN2":
		return "LATIN-2"
	// override cyrillic
	case "WIN1251", "WIN-1251", "WINDOWS-1251":
		return "CP1251"
	// override Hebrew
	case "WINDOWS-1255":
		return "ISO-8859-8"
	// override Turkish
	//case "WINDOWS-1254":
	//	return "ISO-8859-9"
	// override the parsing of ISO-8859-1 to behave as Windows-1252 (CP1252):
	// in ISO-8859-1, everything from 128-255 in the ASCII table are ctrl characters,
	// whilst in CP1252 they're symbols
	// override Baltic
	case "WINDOWS-1257":
		return "ISO-8859-13"
	case "ANSI", "LATIN-1", "ISO", "RFC", "MACINTOSH", "8859-1", "8859-15", "ISO8859-1", "ISO8859-15", "ISO-8559-1", "ISO-8859-1", "ISO-8859-15":
		return "CP1252"
	}
	return characterSet
}

// UTF8encode converts a string from the source character set to UTF-8, skipping invalid byte sequences
// @see http://stackoverflow.com/questions/32512500/ignore-illegal-bytes-when-decoding-text-with-go
func UTF8encode(raw string, sourceCharset string) string {
	enc, name := charset.Lookup(sourceCharset)
	if nil == enc {
		log.Println("Cannot convert from", sourceCharset, ":", name)
		return raw
	}

	dst := make([]byte, len(raw))
	d := enc.NewDecoder()

	var (
		in  int
		out int
	)
	for in < len(raw) {
		// Do the transformation
		ndst, nsrc, err := d.Transform(dst[out:], []byte(raw[in:]), true)
		in += nsrc
		out += ndst
		if err == nil {
			// Completed transformation
			break
		}
		if err == transform.ErrShortDst {
			// Our output buffer is too small, so we need to grow it
			t := make([]byte, (cap(dst)+1)*2)
			copy(t, dst)
			dst = t
			continue
		}
		// We're here because of at least one illegal character. Skip over the current rune
		// and try again.
		_, width := utf8.DecodeRuneInString(raw[in:])
		in += width
	}
	return string(dst)
}
