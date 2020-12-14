# genderize
Go library for the [genderize.io](https://genderize.io/) API

[![GoDoc](https://godoc.org/github.com/smt923/genderize?status.svg)](https://godoc.org/github.com/smt923/genderize)

## Usage
The library implements single and multiple name lookups as well as the Localize versions of these for the [localization settings](https://genderize.io/#localization) supported by the API. Library documentation can be found [here on godoc](https://godoc.org/github.com/smt923/genderize).
```
go get github.com/smt923/genderize
```
```
import "github.com/smt923/genderize"
```
Basic usage looks like this:
```go
package main

import (
	"fmt"

	"github.com/smt923/genderize"
)

func main() {
	p, err := genderize.Single("pete")
	if err != nil {
		panic(err)
	}
	fmt.Println(p.Name, p.Gender.String())
}
```
This will print the received name and the gender as returned by the API.

The gender from the API is stored as a simple enum:
```go
Unknown GenderType = iota // 0
Male // 1
Female // 2
```
...and comparisons can be made by simply accessing these
```go
p, _ := genderize.Single("pete")

if p.Gender == genderize.Male
```

### Localization
```go
users := []string{"anton", "kate", "alexander"}
config := genderize.Config{Country: "de"}

results, err := genderize.MultipleLocalize(users, config)
if err != nil {
	panic(err)
}

for _, v := range results {
	fmt.Println(v.Name)
}
```

### API Key
The optional API key from [genderize's store](https://store.genderize.io/) can be used by specifying it to genderize.APIKey:
```go
genderize.APIKey = "mysecretapikey"
```
Current rate limit information is exposed to the .RateLimit field of the result