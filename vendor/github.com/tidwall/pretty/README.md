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
BenchmarkPretty-16           1000000    1034 ns/op    720 B/op     2 allocs/op
BenchmarkPrettySortKeys-16    586797    1983 ns/op   2848 B/op    14 allocs/op
BenchmarkUgly-16             4652365     254 ns/op    240 B/op     1 allocs/op
BenchmarkUglyInPlace-16      6481233     183 ns/op      0 B/op     0 allocs/op
BenchmarkJSONIndent-16        450654    2687 ns/op   1221 B/op     0 allocs/op
BenchmarkJSONCompact-16       685111    1699 ns/op    442 B/op     0 allocs/op
```

*These benchmarks were run on a MacBook Pro 2.4 GHz 8-Core Intel Core i9.*

## Contact
Josh Baker [@tidwall](http://twitter.com/tidwall)

## License

Pretty source code is available under the MIT [License](/LICENSE).

