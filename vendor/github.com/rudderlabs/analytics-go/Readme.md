
## Installation

The package can be simply installed via "go get", we recommend that you use a tool like
Godep to avoid issues related to API breaking changes introduced between major
versions of the library.

To install it in the GOPATH:
```
go get https://github.com/rudderlabs/analytics-go
```


## Usage

```go
package main

import (
    "os"

    "github.com/rudderlabs/analytics-go"
)

func main() {
    // Instantiates a client to use send messages to the Rudder API.
    // User your WRITE KEY in below placeholder "RUDDER WRITE KEY"
    client := analytics.New("RUDDER WRITE KEY")

    // Enqueues a track event that will be sent asynchronously.
    client.Enqueue(analytics.Track{
        UserId: "test-user",
        Event:  "test-snippet",
    })

    // Flushes any queued messages and closes the client.
    client.Close()
}
```

## License

The library is released under the [MIT license](License.md).
