package docextractor

import (
	"io"
	"io/ioutil"
	"unicode"
	"unicode/utf8"
)

type plainExtractor struct{}

func (pe *plainExtractor) Match(filename string) bool {
	return true
}

func (pe *plainExtractor) Extract(filename string, r io.Reader) (string, error) {
	validRanges := []*unicode.RangeTable{
		unicode.L,
		unicode.M,
		unicode.N,
		unicode.P,
		unicode.S,
		unicode.Zs,
		unicode.White_Space,
	}

	text, _ := ioutil.ReadAll(r)
	count := 0
	for {
		c, size := utf8.DecodeRune(text[count:])
		if !unicode.In(c, validRanges...) {
			return "", nil
		}
		if size == 0 {
			break
		}
		count += size
		if count > 1024 {
			break
		}
	}

	return string(text), nil
}
