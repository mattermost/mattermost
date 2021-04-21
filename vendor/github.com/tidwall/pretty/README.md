# Pretty

[![GoDoc](https://img.shields.io/badge/api-reference-blue.svg?style=flat-square)](https://pkg.go.dev/github.com/tidwall/pretty) 

Pretty is a Go package that provides [fast](#performance) methods for formatting JSON for human readability, or to compact JSON for smaller payloads.

Getting Started
===============

## Installing

To start using Pretty, install Go and run `go get`:

```sh
$ go get -u github.com/tidwall/pretty
```

This will retrieve the library.

## Pretty

Using this example:

```json
{"name":  {"first":"Tom","last":"Anderson"},  "age":37,
"children": ["Sara","Alex","Jack"],
"fav.movie": "Deer Hunter", "friends": [
    {"first": "Janet", "last": "Murphy", "age": 44}
  ]}
```

The following code:
```go
result = pretty.Pretty(example)
```

Will format the json to:

```json
{
  "name": {
    "first": "Tom",
    "last": "Anderson"
  },
  "age": 37,
  "children": ["Sara", "Alex", "Jack"],
  "fav.movie": "Deer Hunter",
  "friends": [
    {
      "first": "Janet",
      "last": "Murphy",
      "age": 44
    }
  ]
}
```

## Color

Color will colorize the json for outputing to the screen. 

```json
result = pretty.Color(json, nil)
```

Will add color to the result for printing to the terminal.
The second param is used for a customizing the style, and passing nil will use the default `pretty.TerminalStyle`.

## Ugly

The following code:
```go
result = pretty.Ugly(example)
```

Will format the json to:

```json
{"name":{"first":"Tom","last":"Anderson"},"age":37,"children":["Sara","Alex","Jack"],"fav.movie":"Deer Hunter","friends":[{"first":"Janet","last":"Murphy","age":44}]}```
```

## Spec

Spec cleans comments and trailing commas from input JSON, converting it to
valid JSON per the official spec: https://tools.ietf.org/html/rfc8259

The resulting JSON will always be the same length as the input and it will
include all of the same line breaks at matching offsets. This is to ensure
the result can be later processed by a external parser and that that
parser will report messages or errors with the correct offsets.

The following example uses a JSON document that has comments and trailing
commas and converts it prior to unmarshalling to using the standard Go
JSON library.

```go

data := `
{
  /* Dev Machine */
  "dbInfo": {
    "host": "localhost",
    "port": 5432,          // use full email address
    "username": "josh",
    "password": "pass123", // use a hashed password
  }
  /* Only SMTP Allowed */
  "emailInfo": {
    "email": "josh@example.com",
    "password": "pass123",
    "smtp": "smpt.example.com",
  }
}
`

err := json.Unmarshal(pretty.Spec(data), &config)

```



## Customized output

There's a `PrettyOptions(json, opts)` function which allows for customizing the output with the following options:

```go
type Options struct {
	// Width is an max column width for single line arrays
	// Default is 80
	Width int
	// Prefix is a prefix for all lines
	// Default is an empty string
	Prefix string
	// Indent is the nested indentation
	// Default is two spaces
	Indent string
	// SortKeys will sort the keys alphabetically
	// Default is false
	SortKeys bool
}
```
## Performance

Benchmarks of Pretty alongside the builtin `encoding/json` Indent/Compact methods.
```
BenchmarkPretty-8            1000000     1283 ns/op      720 B/op      2 allocs/op
BenchmarkUgly-8              3000000      426 ns/op      240 B/op      1 allocs/op
BenchmarkUglyInPlace-8       5000000      340 ns/op        0 B/op      0 allocs/op
BenchmarkJSONIndent-8         300000     4628 ns/op     1069 B/op      4 allocs/op
BenchmarkJSONCompact-8       1000000     2469 ns/op      758 B/op      4 allocs/op
```

*These benchmarks were run on a MacBook Pro 15" 2.8 GHz Intel Core i7 using Go 1.7.*

## Contact
Josh Baker [@tidwall](http://twitter.com/tidwall)

## License

Pretty source code is available under the MIT [License](/LICENSE).

