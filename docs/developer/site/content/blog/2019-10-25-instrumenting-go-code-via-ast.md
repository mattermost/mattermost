---
title: "Instrumenting Go code via AST"
heading: "Instrumenting Go Code via AST - Part 2"
description: "Learn about what Go AST is, why we need it, and instrumenting our handlers with tracing code."
slug: instrumenting-go-code-via-ast
series: "AST"
date: 2019-10-31T00:00:00-04:00
author: Eli Yukelzon
github: reflog
toc: true
community: eli.yukelzon
---

We've been working on integrating call tracing in the server to provide exact measurements of all API and DB calls.
We've picked {{< newtabref href="https://github.com/opentracing/opentracing-go" title="OpenTracing" >}} - a lovely open source project that allows you to setup trace reporting and enables you to support {{< newtabref href="https://opentracing.io/docs/overview/what-is-tracing/" title="Distributed tracing" >}}.

Instrumenting your API handler in Go is very straightforward - setup a connection to a collection server supporting the OpenTracing spec (we've decided to use {{< newtabref href="https://www.jaegertracing.io/" title="Jaeger" >}}) and wrap your code in spans.

To simplify this, we've added a simple tracing module:
```go
package tracing

import (
    "context"

    opentracing "github.com/opentracing/opentracing-go"
    "github.com/uber/jaeger-client-go"
    jaegercfg "github.com/uber/jaeger-client-go/config"
    jaegerlog "github.com/uber/jaeger-client-go/log"
    "github.com/uber/jaeger-lib/metrics"
)

var initialized = false

func Initialize() error {
    cfg := jaegercfg.Configuration{
        Sampler: &jaegercfg.SamplerConfig{
                Type:  jaeger.SamplerTypeConst,
                Param: 1,
        },
        Reporter: &jaegercfg.ReporterConfig{
                LogSpans: true,
        },
    }

    _, err := cfg.InitGlobalTracer(
        "mattermost",
        jaegercfg.Logger(jaegerlog.StdLogger),
        jaegercfg.Metrics(metrics.NullFactory),
    )
    if err != nil {
        return err
    }

    initialized = true

    return nil
}

func StartRootSpanByContext(ctx context.Context, operationName string) (opentracing.Span, context.Context) {
    return opentracing.StartSpanFromContext(ctx, operationName)
}

func StartSpanWithParentByContext(ctx context.Context, operationName string) (opentracing.Span, context.Context) {
    parentSpan := opentracing.SpanFromContext(ctx)

    if parentSpan == nil {
        return StartRootSpanByContext(ctx, operationName)
    }

    return opentracing.StartSpanFromContext(ctx, operationName, opentracing.ChildOf(parentSpan.Context()))
}
```


Now, wrapping an API call in a span is very easy:

```go

func apiCall(c *Context, w http.ResponseWriter, r *http.Request) {
    span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:apiCall")
    c.App.Context = ctx
    defer span.Finish()

    // perform actual request handling
}
```

Now, each time the `apiCall` handler is invoked, it will be measured and traced on Jaeger.

The problem is that we have a rather large API surface (around 300+ handlers) and it would be a really tough task to instrument all the handlers by hand. That's where our story begins.


## Go AST

So what is an AST really? Well, to quote {{< newtabref href="https://www.wikiwand.com/en/Abstract_syntax_tree" title="Wikipedia" >}}:

> In computer science, an abstract syntax tree (AST), or just syntax tree, is a tree representation of the abstract syntactic structure of source code written in a programming language. Each node of the tree denotes a construct occurring in the source code.

![ast example](/blog/2019-10-25-instrumenting-go-code-via-ast/Abstract_syntax_tree_for_Euclidean_algorithm.png)

Basically, an AST is a tree-like representation of your source code.

Why do we need it?

Parsing the code into an AST allows us to refactor code on a statement level, meaning, instead of finding methods and fields using string search, we can find them by their actual structure. This gives us incredible flexibility in writing custom go refactoring tools.

Let's see a small example for a 'Hello World' program:

```go
package main

import (
	"fmt"
)

func main() {
	fmt.Printf("Hello, Golang\n")
}

```

After passing it through `go/parser`, we get the following structure (image generated using: http://goast.yuroyoro.net/):

![hello ast](/blog/2019-10-25-instrumenting-go-code-via-ast/hello_ast.png)

So given this structure, we can easily find, for example, the `Printf` statement by looking at `File.Decls[1].Body.List[0]`.

Now that we understand the basic idea behind ASTs, let's go ahead and try to solve the issue at hand - instrumenting our handlers with tracing code.

## Analyzing existing code

### Finding the pattern

The first thing we need is to identify the methods that we want to instrument. In our code base, all of the API handlers sit in the `api4` folder and each method that handles a certain API has the same signature:

```go
func apiCall(c *Context, w http.ResponseWriter, r *http.Request) {
    // perform actual request handling
}
```

So we are looking at a function that has **exactly** 3 arguments, with specific names and types.

Let's write some AST walker boilerplate that will go through all the files in the `api4` folder and parse them:

```go
package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"io/ioutil"
)

func fix(dir string) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, nil, parser.ParseComments)
	if err != nil {
		panic(err)
	}

	for _, pkg := range pkgs {
		for fileName, file := range pkg.Files {
			fmt.Printf("working on file %v\n", fileName)
			ast.Inspect(file, func(n ast.Node) bool {
                // perform analysis here
				return true
			})

			buf := new(bytes.Buffer)
			err := format.Node(buf, fset, file)
			if err != nil {
				fmt.Printf("error: %v\n", err)
			} else if fileName[len(fileName)-8:] != "_test.go" {
				ioutil.WriteFile(fileName, buf.Bytes(), 0664)
			}
		}
	}
}

func main() {
	fix("./api4")
}
```

`ast.Inspect` visits all AST nodes in each file and provides us with a parsed token.
To only operate on specific nodes in the AST, we try to cast to the type we are interested in and only then proceed:

```go
fn, ok  := n.(*ast.FuncDecl)
if ok {
  // current node is a function!
}
```

Next we need to extract and analyze the parameters to the function (we'll also add a small helper function to get a node as a string):
```go
func FormatNode(node ast.Node) string {
	buf := new(bytes.Buffer)
	_ = format.Node(buf, token.NewFileSet(), node)
	return buf.String()
}
// retreive function's parameter list
params  := fn.Type.Params.List
// we are only interested in functions with exactly 3 parameters
if  len(params) ==  3 {
	first_parameter_is_c := FormatNode(params[0].Names[0]) ==  "c"  &&  FormatNode(params[0].Type) ==  "*Context"
	second_parameter_is_w := FormatNode(params[1].Names[0]) ==  "w"  &&  FormatNode(params[1].Type) ==  "http.ResponseWriter"  
	third_parameters_is_r := FormatNode(params[2].Names[0]) ==  "r"  &&  FormatNode(params[2].Type) ==  "*http.Request"
	if first_parameter_is_c && second_parameter_is_w && third_parameters_is_r {
		// this is an API handler!
	}
}
```

Now that we've found our function, the fun begins! We want to add a couple of statements as described in the introduction and a relevant import.

## Instrumenting the code

As a reminder, this is the piece of code we want to inject at the beginning of every API handler to instrument the code:
```go
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:apiCall")
	c.App.Context = ctx
    defer span.Finish()
```

First of all - we need to take care of imports. We are using the 'tracing' module so we need to add just one line (utilizing the golang.org/x/tools/go/ast/astutil module):
```go
astutil.AddImport(fset, file, "github.com/mattermost/mattermost-server/services/tracing")
```
Now we are ready to inject the code. To do that, we need to convert it from its textual representation into a set of AST nodes.
To help us do that, we can feed that code to {{< newtabref href="http://goast.yuroyoro.net/" title="http://goast.yuroyoro.net/" >}} to receive the parsed tree. With that in hand, we are ready to write our instrumentation code:

```go
// first statement is the assignment:
// span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:apiCall")
a1 := ast.AssignStmt{
    // token.DEFINE is := 
	Tok: token.DEFINE,
	// left hand side has two identifiers, span and ctx
	Lhs: []ast.Expr{
		&ast.Ident{Name: "span"},
		&ast.Ident{Name: "ctx"},
	},
	// right hand is a call to function
	Rhs: []ast.Expr{
		&ast.CallExpr{
		    // function is taken from a module 'tracing' by it's name
			Fun: &ast.SelectorExpr{
				X:   &ast.Ident{Name: "tracing"},
				Sel: &ast.Ident{Name: "StartSpanWithParentByContext"},
			},
			// function has two arguments
			Args: []ast.Expr{
			    // c.App.Context
				&ast.SelectorExpr{
					X: &ast.SelectorExpr{
						X:   &ast.Ident{Name: "c"},
						Sel: &ast.Ident{Name: "App"},
					},
					Sel: &ast.Ident{Name: "Context"},
				},
				// handler identifier, a basic string which we prepare based on current moduleName and function name
				&ast.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("\"api4:%s:%s\"", moduleName, fn.Name.Name)},
			},
		},
	},
}
// second statement is a simple assignment
// c.App.Context = ctx							
a2 := ast.AssignStmt{
    // token.ASSIGN is =
	Tok: token.ASSIGN,
	Lhs: []ast.Expr{
		&ast.SelectorExpr{
			X: &ast.SelectorExpr{
				X:   &ast.Ident{Name: "c"},
				Sel: &ast.Ident{Name: "App"},
			},
			Sel: &ast.Ident{Name: "Context"},
		},
	},
	Rhs: []ast.Expr{
		&ast.Ident{Name: "ctx"},
	},
}
// last statement is 'defer'							
a3 := ast.DeferStmt{
	// what function call should be deferred?
	Call: &ast.CallExpr{
	    // Finish from 'span' identifier
		Fun: &ast.SelectorExpr{
			X:   &ast.Ident{Name: "span"},
			Sel: &ast.Ident{Name: "Finish"},
		},
	},
}
// now we prepend the three statements before the rest of function body							
fn.Body.List = append([]ast.Stmt{&a1, &a2, &a3}, fn.Body.List...)
```

And that's it! We have our custom refactoring/instrumentation tool that we can tweak however we want.

## Go2AST

Since the process of writing AST code by hand based on `go/printer` or {{< newtabref href="http://goast.yuroyoro.net/" title="http://goast.yuroyoro.net/" >}} is rather tedious, I've taken the code of `go/printer` and converted it into a reusable CLI command that does all the work for you! Just feed it some Go code and it'll spit out a ready-to-paste AST tree. 

Take a look here: {{< newtabref href="https://github.com/reflog/go2ast" title="https://github.com/reflog/go2ast" >}}.

## Conclusion

Writing refactoring tools is fun and the possibilities are endless. The Go standard library contains everything you need to create your own little tools for every repeatable task.
Seeing code as an AST for the first time can be a little daunting, but once you get this knowledge in your tool-belt, you'll look for other places to apply it immediately! 

