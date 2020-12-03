package date_constraints

import (
	"bytes"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Constraints is one or more constraint that a date can be
// checked against.
type Constraints struct {
	constraints [][]*constraint
}

// NewConstraint returns a Constraints instance that a time.Time instance can
// be checked against. If there is a parse error it will be returned.
func NewConstraint(c string) (*Constraints, error) {

	// Rewrite - ranges into a comparison operation.
	c = rewriteRange(c)

	ors := strings.Split(c, "||")
	or := make([][]*constraint, len(ors))
	for k, v := range ors {

		// TODO: Find a way to validate and fetch all the constraints in a simpler form

		// Validate the segment
		if !validConstraintRegex.MatchString(v) {
			return nil, fmt.Errorf("improper constraint: %s", v)
		}

		cs := findConstraintRegex.FindAllString(v, -1)
		if cs == nil {
			cs = append(cs, v)
		}
		result := make([]*constraint, len(cs))
		for i, s := range cs {
			pc, err := parseConstraint(s)
			if err != nil {
				return nil, err
			}

			result[i] = pc
		}
		or[k] = result
	}

	o := &Constraints{constraints: or}
	return o, nil
}

// Check tests if a date satisfies the constraints.
func (cs Constraints) Check(v *time.Time) bool {
	for _, o := range cs.constraints {
		joy := true
		for _, c := range o {
			if check, _ := c.check(v); !check {
				joy = false
				break
			}
		}

		if joy {
			return true
		}
	}

	return false
}

// Validate checks if a date satisfies a constraint. If not a slice of
// reasons for the failure are returned in addition to a bool.
func (cs Constraints) Validate(v *time.Time) (bool, []error) {
	// loop over the ORs and check the inner ANDs
	var e []error

	for _, o := range cs.constraints {
		joy := true
		for _, c := range o {
			if _, err := c.check(v); err != nil {
				e = append(e, err)
				joy = false
			}
		}

		if joy {
			return true, []error{}
		}
	}

	return false, e
}

func (cs Constraints) String() string {
	buf := make([]string, len(cs.constraints))
	var tmp bytes.Buffer

	for k, v := range cs.constraints {
		tmp.Reset()
		vlen := len(v)
		for kk, c := range v {
			tmp.WriteString(c.string())

			// Space separate the AND conditions
			if vlen > 1 && kk < vlen-1 {
				tmp.WriteString(" ")
			}
		}
		buf[k] = tmp.String()
	}

	return strings.Join(buf, " || ")
}

var constraintOps map[string]cfunc
var constraintRegex *regexp.Regexp
var constraintRangeRegex *regexp.Regexp

// Used to find individual constraints within a multi-constraint string
var findConstraintRegex *regexp.Regexp

// Used to validate an segment of ANDs is valid
var validConstraintRegex *regexp.Regexp

const cvRegex string = `\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?`

func init() {
	constraintOps = map[string]cfunc{
		"!=": constraintNotEqual,
		"=":  constraintEqual,
		">":  constraintGreaterThan,
		"<":  constraintLessThan,
		">=": constraintGreaterThanEqual,
		"=>": constraintGreaterThanEqual,
		"<=": constraintLessThanEqual,
		"=<": constraintLessThanEqual,
	}

	ops := make([]string, 0, len(constraintOps))
	for k := range constraintOps {
		ops = append(ops, regexp.QuoteMeta(k))
	}

	constraintRegex = regexp.MustCompile(fmt.Sprintf(
		`^\s*(%s)\s*(%s)\s*$`,
		strings.Join(ops, "|"),
		cvRegex))

	constraintRangeRegex = regexp.MustCompile(fmt.Sprintf(
		`\s*(%s)\s+-\s+(%s)\s*`,
		cvRegex, cvRegex))

	findConstraintRegex = regexp.MustCompile(fmt.Sprintf(
		`(%s)\s*(%s)`,
		strings.Join(ops, "|"),
		cvRegex))

	validConstraintRegex = regexp.MustCompile(fmt.Sprintf(
		`^(\s*(%s)\s*(%s)\s*\,?)+$`,
		strings.Join(ops, "|"),
		cvRegex))
}

// An individual constraint
type constraint struct {
	// The time used in the constraint check. For example, if a constraint
	// is '<= 2020-03-01T00:00:00Z' then con is an instance representing 2020-03-01T00:00:00Z.
	con *time.Time

	// The original parsed date (e.g., 2020-03-01T00:00:00Z)
	orig string

	// The original operator for the constraint (e.g. <=)
	origfunc string
}

// Check if a date meets the constraint
func (c *constraint) check(v *time.Time) (bool, error) {
	return constraintOps[c.origfunc](v, c)
}

// String prints an individual constraint into a string
func (c *constraint) string() string {
	return c.origfunc + c.orig
}

type cfunc func(v *time.Time, c *constraint) (bool, error)

func parseConstraint(c string) (*constraint, error) {
	if len(c) > 0 {
		m := constraintRegex.FindStringSubmatch(c)
		if m == nil {
			return nil, fmt.Errorf("improper constraint: %s", c)
		}

		cs := &constraint{
			orig:     m[2],
			origfunc: m[1],
		}

		con, err := time.Parse(time.RFC3339, m[2])
		if err != nil {

			// The constraintRegex should catch any regex parsing errors. So,
			// we should never get here.
			return nil, errors.New("constraint Parser Error")
		}

		cs.con = &con

		return cs, nil
	}
	return nil, errors.New("constraint Parser Error")
}

// Constraint functions
func constraintNotEqual(v *time.Time, c *constraint) (bool, error) {
	if v.Equal(*c.con) {
		return false, fmt.Errorf("%s is equal to %s", v, c.orig)
	}

	return true, nil
}

func constraintEqual(v *time.Time, c *constraint) (bool, error) {
	if !v.Equal(*c.con) {
		return false, fmt.Errorf("%s is not equal to %s", v, c.orig)
	}

	return true, nil
}

func constraintGreaterThan(v *time.Time, c *constraint) (bool, error) {
	if v.After(*c.con) {
		return true, nil
	}
	return false, fmt.Errorf("%s is less than or equal to %s", v, c.orig)
}

func constraintLessThan(v *time.Time, c *constraint) (bool, error) {
	if v.Before(*c.con) {
		return true, nil
	}
	return false, fmt.Errorf("%s is greater than or equal to %s", v, c.orig)
}

func constraintGreaterThanEqual(v *time.Time, c *constraint) (bool, error) {
	if v.After(*c.con) || v.Equal(*c.con) {
		return true, nil
	}
	return false, fmt.Errorf("%s is less than %s", v, c.orig)
}

func constraintLessThanEqual(v *time.Time, c *constraint) (bool, error) {
	if v.Before(*c.con) || v.Equal(*c.con) {
		return true, nil
	}
	return false, fmt.Errorf("%s is greater than %s", v, c.orig)
}

func rewriteRange(i string) string {
	m := constraintRangeRegex.FindAllStringSubmatch(i, -1)
	if m == nil {
		return i
	}
	o := i
	for _, v := range m {
		t := fmt.Sprintf(">= %s, <= %s", v[1], v[11])
		o = strings.Replace(o, v[0], t, 1)
	}

	return o
}
