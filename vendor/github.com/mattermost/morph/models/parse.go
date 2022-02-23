package models

import (
	"fmt"
	"regexp"
)

// Direction is either up or down.
type Direction string

const (
	Down Direction = "down"
	Up   Direction = "up"
)

var (
	ErrParse = fmt.Errorf("no match")
)

// Regex matches the following pattern:
//  123_name.up.ext
//  123_name.down.ext
var Regex = regexp.MustCompile(`^([0-9]+)_(.*)\.(` + string(Down) + `|` + string(Up) + `)\.(.*)$`)
