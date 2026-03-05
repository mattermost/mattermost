---
title: Maintaining Consistency in Codebases with Go vet
slug: maintaining-consistency-in-codebases-with-go-vet
date: 2020-03-17
categories:
    - "go"
author: Jesús Espino
github: jespino
community: jesus.espino
canonicalUrl: https://developers.mattermost.com/blog/maintaining-consistency-in-codebases-with-go-vet/
---

Maintaining success in a large open-source project is one of the key objectives
of Mattermost. We have hundreds of contributors and we want to create a project
that could serve as a model in the Go community. Having said that, following
idiomatic Go principles is the thing that we care most about while maintaining our
code consistency. For this specific task, we utilized `go vet` and with this
blog post, I would like to explain how we pushed the limits of this tool by
extending it.

The main restriction of `go vet` is that there are a limited number of absolute
truths about what is right and what is wrong and so the `go vet` checks are very
general.

Although `go vet` has great use in common checks, having domain-specific or even
company-specific checks is inevitable to maintain a project at our scale. In
Mattermost we have a way of doing certain things like logging, test assertions,
and adding license headers to the source files. We try our best to keep code
consistent and work hard to avoid reintroducing old patterns in the
code.

I think the best way to explain it is with an example.

Some time ago, we redesigned our logging implementation and it's a
great example to showcase our work around maintaining consistency. While
migrating to the new approach didn't happen with the snap of a finger, we
observed that the old way of logging was making its way into new PRs. Also in
such cases, the old pattern was one of the obvious approaches that you can
follow to present data in the logs.

Let's dive deeper into the topic, and I will try my best to explain how we extended the `go
vet` tool by adding our own specific checks.

A good starting point is the {{< newtabref href="https://github.com/mattermost/mattermost-govet/blob/master/structuredLogging/structuredLogging.go" title="check" >}}
we added so that we could avoid any string building with `fmt.Sprintf` calls as
part of the calls to our logging library. With that check implemented we were able
to detect all the cases in the code where we were not doing structured logging
and replace them with the properly structured logging approach. We then
added that check to our CI pipeline to ensure that the pattern was not
reintroduced accidentally by us or by any contributor.

Another interesting example is our approach to improve the consistency of test
assertions. We use the {{< newtabref href="https://github.com/stretchr/testify" title="Testify" >}} library
to include more semantic assertions, but at the same time, we were using
`t.Fatalf` calls in certain places. The `t.Fatalf` method of failing tests was
less semantic because the test's error itself is not necessarily related to the
assertion. We created a {{< newtabref href="https://github.com/mattermost/mattermost-govet/blob/master/tFatal/tFatal.go" title="check to avoid the use of `t.Fatalf`" >}} in our tests.

Once we had that, we discovered that we have some incorrectly defined
assertions. For example, we were using `require.Equal(t, 5, len(x))` which is
less semantic than `require.Len(t, x, 5)`. We created a {{< newtabref href="https://github.com/mattermost/mattermost-govet/blob/master/equalLenAsserts/equalLenAsserts.go" title="check for semantic length assertions" >}},
adding a suggestion in the error message to replace it with the
correct assertion. We kept digging there, and we discovered that sometimes we
were checking `require.Len(t, x, 0)` which can be more semantically written as
`require.Empty(t, x)`, so we wrote the check for that, and included in the check
the case for `require.Equal(t, 0, len(x))` suggesting in both cases to use
`require.Empty(t, x)`.

Other checks have been made for other purposes. For example, checking the
{{< newtabref href="https://github.com/mattermost/mattermost-govet/blob/master/license/license.go" title="consistency and existence of the license in the header of our files" >}}, or
checking for the {{< newtabref href="https://github.com/mattermost/mattermost-govet/tree/master/inconsistentReceiverName" title="consistency in the receiver variable name of the methods for the same structure" >}}.

Extending `go vet` is a really easy task, you only need some knowledge about the
Go AST because almost anything else is already handled by the `go vet` tool. As
an example, let's implement a `go vet` check to find forbidden words in the
strings of our code.

The first thing that we need is an Analyzer. An Analyzer is the struct
responsible for receiving the AST (and some other things), finding the things that
we consider errors, notifying `go vet` of those errors, and alerting the user.

Let's build our Analyzer.

```go
// File: checkwords.go
package main

import (
	"go/ast"
	"go/token"
	"strings"

	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/unitchecker"
)

var analyzer = &analysis.Analyzer{
	Name: "checkWords",
	Doc:  "check forbidden words usage in our strings",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	forbiddenWords := []string{
		"bird",
		"water",
		"candy",
	}

	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.BasicLit:
				if x.Kind != token.STRING {
					return false
				}
				words := strings.Fields(x.Value)
				for _, word := range words {
					for _, forbiddenWord := range forbiddenWords {
						if word == forbiddenWord {
							pass.Reportf(x.Pos(), "Forbidden word used, please do not use the word %s in your strings", word)
						}
					}
				}
				return false
			}
			return true
		})
	}
	return nil, nil
}

func main() {
	unitchecker.Main(
		analyzer,
	)
}
```

Our Analyzer is inspecting all the files searching for `*ast.BasicLit` of `Kind`
`token.STRING`, which are our literal strings. It splits those strings by spaces,
and checks whether any of them match the forbidden words (this is a completely
basic approach, and doesn't catch a lot of cases, but for the sake of
simplicity I'll leave it as is). If it finds any forbidden words, it reports to
the user with an error message; `go vet` handles printing the filename and
location of the error.

Once we have our Analyzer we only have to register the Analyzer in our main
function to connect it with `go vet` using the `unitchecker.Main` function (we can
register multiple analyzers there).

Now we only need to compile it with `go build ./checkwords.go` and use it with
`go vet -vettool=./checkwords -checkWords ./file-or-module-path`.

For example, we can create an `example.go` file like this:

```go
package main

import "fmt"

func main() {
	fmt.Println("my candy is forbidden!")
	fmt.Println("but other strings are not")
}
```

and run our `go vet` tool to check this with `go vet -vettool=./checkwords -checkWords example.go` and the resulting output is:

```
# command-line-arguments
./example.go:6:14: Forbidden word used, please do not use the word candy in your strings
```

And that is all we need. Now we have an automatic way to detect undesired
patterns in our code.

We have been using our version for a number of months and our conclusion is
that using the `go vet` tool is an excellent opportunity to improve your code. In
addition, extending it allows you to define your own patterns and maintain the
consistency of your code. With our open source culture you can find our
implementations at our
{{< newtabref href="https://github.com/mattermost/mattermost-govet" title="mattermost-govet" >}} repository.
If you see yourself asking for the same changes in PRs all the time, you
can probably consider using `go vet` to detect the issues automatically.

Once the patterns are created you can apply them whenever you want, maybe by
hand from time to time, maybe as a Git hook, maybe enforced by the CI, maybe
you can use it as a one time thing for changing something in your code - the
option you decide on is up to you and your use case.
