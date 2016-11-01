Backo [![GoDoc](http://godoc.org/github.com/segmentio/backo-go?status.png)](http://godoc.org/github.com/segmentio/backo-go)
-----

Exponential backoff for Go (Go port of segmentio/backo).


Usage
-----

```go
import "github.com/segmentio/backo-go"

// Create a Backo instance.
backo := backo.NewBacko(milliseconds(100), 2, 1, milliseconds(10*1000))
// OR with defaults.
backo := backo.DefaultBacko()

// Use the ticker API.
ticker := b.NewTicker()
for {
    timeout := time.After(5 * time.Minute)
    select {
    case  <-ticker.C:
        fmt.Println("ticked")
    case <- timeout:
        fmt.Println("timed out")
    }
}

// Or simply work with backoff intervals directly.
for i := 0; i < n; i++ {
    // Sleep the current goroutine.
    backo.Sleep(i)
    // Retrieve the duration manually.
    duration := backo.Duration(i)
}
```

License
-------

```
WWWWWW||WWWWWW
 W W W||W W W
      ||
    ( OO )__________
     /  |           \
    /o o|    MIT     \
    \___/||_||__||_|| *
         || ||  || ||
        _||_|| _||_||
       (__|__|(__|__|

The MIT License (MIT)

Copyright (c) 2015 Segment, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```



 [1]: http://github.com/segmentio/backo-java
 [2]: http://repository.sonatype.org/service/local/artifact/maven/redirect?r=central-proxy&g=com.segment.backo&a=backo&v=LATEST