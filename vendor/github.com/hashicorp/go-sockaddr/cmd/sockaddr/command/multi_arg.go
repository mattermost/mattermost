package command

import "regexp"

type MultiArg []string

func (v *MultiArg) String() string {
	return ""
}

func (v *MultiArg) Set(raw string) error {
	parts := regexp.MustCompile(`[\s]*,[\s]*`).Split(raw, -1)
	for _, part := range parts {
		*v = append(*v, part)
	}
	return nil
}
