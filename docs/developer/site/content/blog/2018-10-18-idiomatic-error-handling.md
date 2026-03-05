---
title: "Go: Idiomatic Error Handling"
heading: "Go: Idiomatic Error Handling"
description: "At Mattermost, we’re in the midst of an epic to make our error handling code more idiomatic and thus ultimately more accessible."
slug: idiomatic-error-handling
date: 2018-10-18T00:00:00-04:00
categories:
    - "Go"
author: Jesse Hallam
github: lieut-data
community: jesse.hallam
---

Go is an extremely opinionated programming language. `import` something in a file that's not used? It won't compile, and there's no flag to override. While there are {{< newtabref href="https://godoc.org/golang.org/x/tools/cmd/goimports" title="workarounds" >}}, the end result remains the same: Go files are never cluttered by unused imports. This is true for all Go code everywhere, making every Go project more accessible.

Not all Go opinions are enforced by the compiler. Some are documented in {{< newtabref href="https://golang.org/doc/effective_go.html" title="Effective Go" >}}, and yet others are reflected only in the coding style of the Go {{< newtabref href="https://golang.org/pkg/" title="standard library" >}}. This body of opinions defines idiomatic Go: the natural way to write Go code.

Here at Mattermost, we're in the midst of an {{< newtabref href="https://mattermost.atlassian.net/browse/MM-12535" title="epic" >}} to make our error handling code more idiomatic and thus ultimately more accessible. The changes are simple, and best summarized by a section on the {{< newtabref href="https://golang.org/doc/effective_go.html#if" title="Effective Go" >}} document:

> In the Go libraries, you'll find that when an if statement doesn't flow into the next statement—that is, the body ends in break, continue, goto, or return—the unnecessary else is omitted.

> ```go
f, err := os.Open(name)
if err != nil {
    return err
}
codeUsing(f)
```

> This is an example of a common situation where code must guard against a sequence of error conditions. The code reads well if the successful flow of control runs down the page, eliminating error cases as they arise. Since error cases tend to end in return statements, the resulting code needs no else statements.

> ```go
f, err := os.Open(name)
if err != nil {
    return err
}
d, err := f.Stat()
if err != nil {
    f.Close()
    return err
}
codeUsing(f, d)
```

### Real-life Example

Here's a block of code {{< newtabref href="https://github.com/jespino/platform/blob/a257d501df3d0624f9cc52efb602e7d9d2a4dc07/app/notification.go#L38-L43" title="handling notifications" >}} before it was changed:
```go
var profileMap map[string]*model.User
if result := <-pchan; result.Err != nil {
    return nil, result.Err
} else {
    profileMap = result.Data.(map[string]*model.User)
}
```

Notice the `if` statement ending in a `return`, making the `else` unnecessary. Here's the code {{< newtabref href="https://github.com/jespino/platform/blob/2ab1b82d18af545f8483daa1f22af057eb37b879/app/notification.go#L38-L42" title="written idiomatically" >}}:
```go
result := <-pchan
if result.Err != nil {
    return nil, result.Err
}
profileMap := result.Data.(map[string]*model.User)
```

Eliminating the `else` condition required pre-declaring `result` instead of defining it inline. While this is but a minor improvement, frequently that `else` block is much longer with nested conditional statements of its own.

### Is it ok to still declare variables inline to a conditional?

Idiomatic go still allows for variables declared inline with the conditional. Only variables that need to be used outside the conditional should be pre-declared. Here's a correct {{< newtabref href="https://github.com/mattermost/mattermost/blob/ebd540d5fbc10bdc504f7349acbb90ddc4b5e826/app/scheme.go#L13-L15" title="example" >}} of writing idiomatic Go code using a single inline variable:
```go
if err := a.IsPhase2MigrationCompleted(); err != nil {
    return nil, err
}
```

and a correct {{< newtabref href="https://github.com/mattermost/mattermost/blob/5d6d4502992af4120fed19a9db43960d6269b871/store/local_cache_supplier.go#L69-L76" title="example" >}} using multiple inline variables:
```go
if cacheItem, ok := cache.Get(key); ok {
    if s.metrics != nil {
        s.metrics.IncrementMemCacheHitCounter(cache.Name())
    }
    result := NewSupplierResult()
    result.Data = cacheItem
    return result
}
```

### Contributing

Interested in helping us complete these changes? Find an unclaimed {{< newtabref href="https://mattermost.atlassian.net/browse/MM-12535" title="ticket" >}}, and join us on {{< newtabref href="https://community.mattermost.com/core/channels/developers" title="community.mattermost.com" >}} to discuss further.
