package imap

import (
	"bytes"
	"encoding/base64"
	"strings"
	"unicode"
)

func decode2047chunk(s string) (conv []byte, rest string, ok bool) {
	// s is =?...
	// and should be =?charset?e?text?=
	j := strings.Index(s[2:], "?")
	if j < 0 {
		return
	}
	j += 2
	if j+2 >= len(s) || s[j+2] != '?' {
		return
	}
	k := strings.Index(s[j+3:], "?=")
	if k < 0 {
		return
	}
	k += j + 3

	charset, enc, text, rest := s[2:j], s[j+1], s[j+3:k], s[k+2:]
	var encoding string
	switch enc {
	default:
		return
	case 'q', 'Q':
		encoding = "quoted-printable"
	case 'b', 'B':
		encoding = "base64"
	}

	dat := decodeText([]byte(text), encoding, charset, true)
	if dat == nil {
		return
	}
	return dat, rest, true
}

func decodeQP(dat []byte, underscore bool) []byte {
	out := make([]byte, len(dat))
	w := 0
	for i := 0; i < len(dat); i++ {
		c := dat[i]
		if underscore && c == '_' {
			out[w] = ' '
			w++
			continue
		}
		if c == '\r' {
			continue
		}
		if c == '=' {
			if i+1 < len(dat) && dat[i+1] == '\n' {
				i++
				continue
			}
			if i+2 < len(dat) && dat[i+1] == '\r' && dat[i+2] == '\n' {
				i += 2
				continue
			}
			if i+2 < len(dat) {
				v := unhex(dat[i+1])<<4 | unhex(dat[i+2])
				if v >= 0 {
					out[w] = byte(v)
					w++
					i += 2
					continue
				}
			}
		}
		out[w] = c
		w++
	}
	return out[:w]
}

func nocrnl(dat []byte) []byte {
	w := 0
	for _, c := range dat {
		if c != '\r' && c != '\n' {
			dat[w] = c
			w++
		}
	}
	return dat[:w]
}

func decode64(dat []byte) []byte {
	out := make([]byte, len(dat))
	copy(out, dat)
	out = nocrnl(out)
	n, err := base64.StdEncoding.Decode(out, out)
	if err != nil {
		return nil
	}
	return out[:n]
}

func decodeText(dat []byte, encoding, charset string, underscore bool) []byte {
	odat := dat
	switch strlwr(encoding) {
	case "quoted-printable":
		dat = decodeQP(dat, underscore)
	case "base64":
		dat = decode64(dat)
	}
	if dat == nil {
		return nil
	}
	if bytes.IndexByte(dat, '\r') >= 0 {
		if &odat[0] == &dat[0] {
			dat = append([]byte(nil), dat...)
		}
		dat = nocr(dat)
	}

	charset = strlwr(charset)
	if charset == "utf-8" || charset == "us-ascii" {
		return dat
	}
	if charset == "iso-8859-1" {
		// Avoid allocation for iso-8859-1 that is really just ascii.
		for _, c := range dat {
			if c >= 0x80 {
				goto NeedConv
			}
		}
		return dat
	NeedConv:
	}

	// TODO: big5, iso-2022-jp

	tab := convtab[charset]
	if tab == nil {
		return dat
	}
	var b bytes.Buffer
	for _, c := range dat {
		if tab[c] < 0 {
			b.WriteRune(unicode.ReplacementChar)
		} else {
			b.WriteRune(tab[c])
		}
	}
	return b.Bytes()
}

var convtab = map[string]*[256]rune{
	"iso-8859-1":   &tab_iso8859_1,
	"iso-8859-2":   &tab_iso8859_2,
	"iso-8859-3":   &tab_iso8859_3,
	"iso-8859-4":   &tab_iso8859_4,
	"iso-8859-5":   &tab_iso8859_5,
	"iso-8859-6":   &tab_iso8859_6,
	"iso-8859-7":   &tab_iso8859_7,
	"iso-8859-8":   &tab_iso8859_8,
	"iso-8859-9":   &tab_iso8859_9,
	"iso-8859-10":  &tab_iso8859_10,
	"iso-8859-15":  &tab_iso8859_15,
	"koi8-r":       &tab_koi8,
	"windows-1250": &tab_cp1250,
	"windows-1251": &tab_cp1251,
	"windows-1252": &tab_cp1252,
	"windows-1253": &tab_cp1253,
	"windows-1254": &tab_cp1254,
	"windows-1255": &tab_cp1255,
	"windows-1256": &tab_cp1256,
	"windows-1257": &tab_cp1257,
	"windows-1258": &tab_cp1258,
}

func unrfc2047(s string) string {
	if !strings.Contains(s, "=?") {
		return s
	}
	var buf bytes.Buffer
	for {
		// =?charset?e?text?=
		i := strings.Index(s, "=?")
		if i < 0 {
			break
		}
		conv, rest, ok := decode2047chunk(s[i:])
		if !ok {
			buf.WriteString(s[:i+2])
			s = s[i+2:]
			continue
		}
		buf.WriteString(s[:i])
		buf.Write(conv)
		s = rest
	}
	buf.WriteString(s)
	return buf.String()
}

func lwr(c rune) rune {
	if 'A' <= c && c <= 'Z' {
		return c + 'a' - 'A'
	}
	return c
}

func strlwr(s string) string {
	return strings.Map(lwr, s)
}

func unhex(c byte) int {
	switch {
	case '0' <= c && c <= '9':
		return int(c) - '0'
	case 'a' <= c && c <= 'f':
		return int(c) - 'a' + 10
	case 'A' <= c && c <= 'F':
		return int(c) - 'A' + 10
	}
	return -1
}

// TODO: Will need modified UTF-7 eventually.
