# Date Constraints

### Validate a date against constraints

## Overview [![GoDoc](https://godoc.org/github.com/reflog/dateconstraints?status.svg)](https://godoc.org/github.com/reflog/dateconstraints)

This module is heavily based on https://github.com/Masterminds/semver so kudos to [Masterminds](https://github.com/Masterminds/semver).

> _For now only RFC3339 dates are supported_

## Basic Comparisons

There are two elements to the comparisons. First, a comparison string is a list
of space or comma separated AND comparisons. These are then separated by || (OR)
comparisons. For example, `">= 2020-03-01T00:00:00Z < 2020-04-01T00:00:00Z || >= 2020-05-01T00:00:00Z"` is will validate if a date is between 01/03/2020 till 01/04/2020 OR it's after 01/05/2020.

The basic comparisons are:

- `=`: equal
- `!=`: not equal
- `>`: greater than
- `<`: less than
- `>=`: greater than or equal to
- `<=`: less than or equal to

## Usage

```go

import "github.com/reflog/dateconstraints"
import "time"

func main(){

    date, _ := time.Parse(time.RFC3339, "2020-03-10T00:00:00Z")
    c, _ := date_constraints.NewConstraint("> 2020-03-01T00:00:00Z <= 2020-04-01T00:00:00Z")
    if c.Check(&date) {
        // date is in range!
    }
}

```

## Validation

In addition to testing a date against a constraint, it can be validated
against a constraint. When validation fails a slice of errors containing why a
date didn't meet the constraint is returned. For example,

```go
c, err := date_constraints.NewConstraint("<= 2020-03-01T00:00:00Z, >= 2020-04-10T00:00:00Z")
if err != nil {
    // Handle constraint not being parseable.
}
v, err := time.Parse(time.RFC3339, "2020-03-10T00:00:00Z")
if err != nil {
    // Handle date not being parseable.
}
// Validate a date against a constraint.
a, msgs := c.Validate(&v)
// a is false
for _, m := range msgs {
    fmt.Println(m)
    // Loops over the errors which would read
    // "2020-03-10T00:00:00Z is greater than 2020-03-01T00:00:00Z"
    // "2020-03-01T00:00:00Z is less than 2020-04-01T00:00:00Z"
}
```

## Install

```
go get github.com/reflog/dateconstraints
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
