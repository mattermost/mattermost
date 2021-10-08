# GJSON Path Syntax

A GJSON Path is a text string syntax that describes a search pattern for quickly retreiving values from a JSON payload.

This document is designed to explain the structure of a GJSON Path through examples.

- [Path structure](#path-structure)
- [Basic](#basic)
- [Wildcards](#wildcards)
- [Escape Character](#escape-character)
- [Arrays](#arrays)
- [Queries](#queries)
- [Dot vs Pipe](#dot-vs-pipe)
- [Modifiers](#modifiers)
- [Multipaths](#multipaths)

The definitive implemenation is [github.com/tidwall/gjson](https://github.com/tidwall/gjson).  
Use the [GJSON Playground](https://gjson.dev) to experiment with the syntax online.


## Path structure

A GJSON Path is intended to be easily expressed as a series of components seperated by a `.` character. 

Along with `.` character, there are a few more that have special meaning, including `|`, `#`, `@`, `\`, `*`, and `?`.

## Example

Given this JSON

```json
{
  "name": {"first": "Tom", "last": "Anderson"},
  "age":37,
  "children": ["Sara","Alex","Jack"],
  "fav.movie": "Deer Hunter",
  "friends": [
    {"first": "Dale", "last": "Murphy", "age": 44, "nets": ["ig", "fb", "tw"]},
    {"first": "Roger", "last": "Craig", "age": 68, "nets": ["fb", "tw"]},
    {"first": "Jane", "last": "Murphy", "age": 47, "nets": ["ig", "tw"]}
  ]
}
```

The following GJSON Paths evaluate to the accompanying values.

### Basic 

In many cases you'll just want to retreive values by object name or array index.

```go
name.last              "Anderson"
name.first             "Tom"
age                    37
children               ["Sara","Alex","Jack"]
children.0             "Sara"
children.1             "Alex"
friends.1              {"first": "Roger", "last": "Craig", "age": 68}
friends.1.first        "Roger"
```

### Wildcards

A key may contain the special wildcard characters `*` and `?`. 
The `*` will match on any zero+ characters, and `?` matches on any one character.

```go
child*.2               "Jack"
c?ildren.0             "Sara"
```

### Escape character

Special purpose characters, such as `.`, `*`, and `?` can be escaped with `\`. 

```go
fav\.movie             "Deer Hunter"
```

You'll also need to make sure that the `\` character is correctly escaped when hardcoding a path in you source code.

```go
// Go
val := gjson.Get(json, "fav\\.movie")  // must escape the slash
val := gjson.Get(json, `fav\.movie`)   // no need to escape the slash 
```

```rust
// Rust
let val = gjson::get(json, "fav\\.movie")     // must escape the slash
let val = gjson::get(json, r#"fav\.movie"#)   // no need to escape the slash 
```


### Arrays

The `#` character allows for digging into JSON Arrays.

To get the length of an array you'll just use the `#` all by itself.

```go
friends.#              3
friends.#.age         [44,68,47]
```

### Queries

You can also query an array for the first match by  using `#(...)`, or find all matches with `#(...)#`. 
Queries support the `==`, `!=`, `<`, `<=`, `>`, `>=` comparison operators, 
and the simple pattern matching `%` (like) and `!%` (not like) operators.

```go
friends.#(last=="Murphy").first     "Dale"
friends.#(last=="Murphy")#.first    ["Dale","Jane"]
friends.#(age>45)#.last             ["Craig","Murphy"]
friends.#(first%"D*").last          "Murphy"
friends.#(first!%"D*").last         "Craig"
```

To query for a non-object value in an array, you can forgo the string to the right of the operator.

```go
children.#(!%"*a*")                 "Alex"
children.#(%"*a*")#                 ["Sara","Jack"]
```

Nested queries are allowed.

```go
friends.#(nets.#(=="fb"))#.first  >> ["Dale","Roger"]
```

*Please note that prior to v1.3.0, queries used the `#[...]` brackets. This was
changed in v1.3.0 as to avoid confusion with the new [multipath](#multipaths) 
syntax. For backwards compatibility, `#[...]` will continue to work until the
next major release.*

The `~` (tilde) operator will convert a value to a boolean before comparison.

For example, using the following JSON:

```json
{
  "vals": [
    { "a": 1, "b": true },
    { "a": 2, "b": true },
    { "a": 3, "b": false },
    { "a": 4, "b": "0" },
    { "a": 5, "b": 0 },
    { "a": 6, "b": "1" },
    { "a": 7, "b": 1 },
    { "a": 8, "b": "true" },
    { "a": 9, "b": false },
    { "a": 10, "b": null },
    { "a": 11 }
  ]
}
```

You can now query for all true(ish) or false(ish) values:

```
vals.#(b==~true)#.a    >> [1,2,6,7,8]
vals.#(b==~false)#.a   >> [3,4,5,9,10,11]
```

The last value which was non-existent is treated as `false`

### Dot vs Pipe

The `.` is standard separator, but it's also possible to use a `|`. 
In most cases they both end up returning the same results.
The cases where`|` differs from `.` is when it's used after the `#` for [Arrays](#arrays) and [Queries](#queries). 

Here are some examples

```go
friends.0.first                     "Dale"
friends|0.first                     "Dale"
friends.0|first                     "Dale"
friends|0|first                     "Dale"
friends|#                           3
friends.#                           3
friends.#(last="Murphy")#           [{"first": "Dale", "last": "Murphy", "age": 44},{"first": "Jane", "last": "Murphy", "age": 47}]
friends.#(last="Murphy")#.first     ["Dale","Jane"]
friends.#(last="Murphy")#|first     <non-existent>
friends.#(last="Murphy")#.0         []
friends.#(last="Murphy")#|0         {"first": "Dale", "last": "Murphy", "age": 44}
friends.#(last="Murphy")#.#         []
friends.#(last="Murphy")#|#         2
```

Let's break down a few of these.

The path `friends.#(last="Murphy")#` all by itself results in

```json
[{"first": "Dale", "last": "Murphy", "age": 44},{"first": "Jane", "last": "Murphy", "age": 47}]
```

The `.first` suffix will process the `first` path on each array element *before* returning the results. Which becomes

```json
["Dale","Jane"]
```

But the `|first` suffix actually processes the `first` path *after* the previous result. 
Since the previous result is an array, not an object, it's not possible to process 
because `first` does not exist.

Yet, `|0` suffix returns

```json
{"first": "Dale", "last": "Murphy", "age": 44}
```

Because `0` is the first index of the previous result.

### Modifiers

A modifier is a path component that performs custom processing on the JSON.

For example, using the built-in `@reverse` modifier on the above JSON payload will reverse the `children` array:

```go
children.@reverse                   ["Jack","Alex","Sara"]
children.@reverse.0                 "Jack"
```

There are currently the following built-in modifiers:

- `@reverse`: Reverse an array or the members of an object.
- `@ugly`: Remove all whitespace from JSON.
- `@pretty`: Make the JSON more human readable.
- `@this`: Returns the current element. It can be used to retrieve the root element.
- `@valid`: Ensure the json document is valid.
- `@flatten`: Flattens an array.
- `@join`: Joins multiple objects into a single object.

#### Modifier arguments

A modifier may accept an optional argument. The argument can be a valid JSON payload or just characters.

For example, the `@pretty` modifier takes a json object as its argument.

```
@pretty:{"sortKeys":true}
```

Which makes the json pretty and orders all of its keys.

```json
{
  "age":37,
  "children": ["Sara","Alex","Jack"],
  "fav.movie": "Deer Hunter",
  "friends": [
    {"age": 44, "first": "Dale", "last": "Murphy"},
    {"age": 68, "first": "Roger", "last": "Craig"},
    {"age": 47, "first": "Jane", "last": "Murphy"}
  ],
  "name": {"first": "Tom", "last": "Anderson"}
}
```

*The full list of `@pretty` options are `sortKeys`, `indent`, `prefix`, and `width`. 
Please see [Pretty Options](https://github.com/tidwall/pretty#customized-output) for more information.*

#### Custom modifiers

You can also add custom modifiers. 

For example, here we create a modifier which makes the entire JSON payload upper or lower case.

```go
gjson.AddModifier("case", func(json, arg string) string {
  if arg == "upper" {
    return strings.ToUpper(json)
  }
  if arg == "lower" {
    return strings.ToLower(json)
  }
  return json
})
"children.@case:upper"             ["SARA","ALEX","JACK"]
"children.@case:lower.@reverse"    ["jack","alex","sara"]
```

*Note: Custom modifiers are not yet available in the Rust version*

### Multipaths

Starting with v1.3.0, GJSON added the ability to join multiple paths together
to form new documents. Wrapping comma-separated paths between `[...]` or
`{...}` will result in a new array or object, respectively.

For example, using the given multipath 

```
{name.first,age,"the_murphys":friends.#(last="Murphy")#.first}
```

Here we selected the first name, age, and the first name for friends with the 
last name "Murphy".

You'll notice that an optional key can be provided, in this case 
"the_murphys", to force assign a key to a value. Otherwise, the name of the 
actual field will be used, in this case "first". If a name cannot be
determined, then "_" is used.

This results in

```
{"first":"Tom","age":37,"the_murphys":["Dale","Jane"]}
```


