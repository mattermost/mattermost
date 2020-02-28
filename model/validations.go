package model

import "unicode"

func IsValidId(value string) bool {
	if len(value) != 26 {
		return false
	}

	for _, r := range value {
		if !unicode.IsLetter(r) && !unicode.IsNumber(r) {
			return false
		}
	}

	return true
}
