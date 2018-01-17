
# UserAgent [![Build Status](https://travis-ci.org/mssola/user_agent.png?branch=master)](https://travis-ci.org/mssola/user_agent) [![GoDoc](https://godoc.org/github.com/mssola/user_agent?status.png)](http://godoc.org/github.com/mssola/user_agent)


UserAgent is a Go library that parses HTTP User Agents.

## Usage

~~~ go
package main

import (
    "fmt"

    "github.com/mssola/user_agent"
)

func main() {
    // The "New" function will create a new UserAgent object and it will parse
    // the given string. If you need to parse more strings, you can re-use
    // this object and call: ua.Parse("another string")
    ua := user_agent.New("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.97 Safari/537.11")

    fmt.Printf("%v\n", ua.Mobile())   // => false
    fmt.Printf("%v\n", ua.Bot())      // => false
    fmt.Printf("%v\n", ua.Mozilla())  // => "5.0"

    fmt.Printf("%v\n", ua.Platform()) // => "X11"
    fmt.Printf("%v\n", ua.OS())       // => "Linux x86_64"

    name, version := ua.Engine()
    fmt.Printf("%v\n", name)          // => "AppleWebKit"
    fmt.Printf("%v\n", version)       // => "537.11"

    name, version = ua.Browser()
    fmt.Printf("%v\n", name)          // => "Chrome"
    fmt.Printf("%v\n", version)       // => "23.0.1271.97"

    // Let's see an example with a bot.

    ua.Parse("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")

    fmt.Printf("%v\n", ua.Bot())      // => true

    name, version = ua.Browser()
    fmt.Printf("%v\n", name)          // => Googlebot
    fmt.Printf("%v\n", version)       // => 2.1
}
~~~

Copyright &copy; 2012-2017 Miquel Sabaté Solà, released under the MIT License.
