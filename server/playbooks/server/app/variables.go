package app

import (
	"regexp"
	"strings"
)

var varsReStr = `(\$[a-zA-Z0-9_]+)`

var reVars = regexp.MustCompile(varsReStr)

// reVarsAndVals is the regex use to match variables and their values.
var reVarsAndVals = regexp.MustCompile(`^\s*` + varsReStr + `=(.+)\s*$`)

// parseVariables returns the variables parsed from the given text.
// Each variable must be defined on a separate line, and must match
// the `reVar` regex.
func parseVariablesAndValues(input string) map[string]string {
	lines := strings.Split(input, "\n")
	vars := make(map[string]string)
	for _, line := range lines {
		if !reVarsAndVals.MatchString(line) {
			continue
		}
		match := reVarsAndVals.FindStringSubmatch(line)
		vars[match[1]] = match[2]
	}
	return vars
}

// parseVariables returns the variable names in the given input string.
func parseVariables(input string) []string {
	return reVars.FindAllString(input, -1)
}
