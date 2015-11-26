# Manners

A *polite* webserver for Go.

Manners allows you to shut your Go webserver down gracefully, without dropping any requests. It can act as a drop-in replacement for the standard library's http.ListenAndServe function:

```go
func main() {
  handler := MyHTTPHandler()
  manners.ListenAndServe(":7000", handler)
}
```

Then, when you want to shut the server down:

```go
manners.Close()
```

(Note that this does not block until all the requests are finished. Rather, the call to manners.ListenAndServe will stop blocking when all the requests are finished.)

Manners ensures that all requests are served by incrementing a WaitGroup when a request comes in and decrementing it when the request finishes.

If your request handler spawns Goroutines that are not guaranteed to finish with the request, you can ensure they are also completed with the `StartRoutine` and `FinishRoutine` functions on the server.

### Known Issues

Manners does not correctly shut down long-lived keepalive connections when issued a shutdown command. Clients on an idle keepalive connection may see a connection reset error rather than a close. See https://github.com/braintree/manners/issues/13 for details.

### Compatability

Manners 0.3.0 and above uses standard library functionality introduced in Go 1.3.

### Installation

`go get github.com/braintree/manners`
