---
title: "Instrumenting Go code via AST, Part 2"
heading: "Instrumenting Go Code via AST - Part 1"
description: "This is the second part of our AST blog post series, expanding on the subject of utilizing Go AST libraries to automate and improve your workflow."
slug: instrumenting-go-code-via-ast-2
series: "AST"
date: 2020-03-15T00:00:00-04:00
author: Eli Yukelzon
toc: true
github: reflog
community: eli.yukelzon
---

## Welcome!

This is the second part of our AST blog post series, expanding on the subject of utilizing Go AST libraries to automate and improve your workflow.

In this post I'll discuss a rather common problem that comes up while working with Go code and the way we've solved it by sprinkling a little bit of AST magic dust. Let's dive in.

## Problem: A `struct` with no `interface`

Let's say you are working on a large code base that was not built with `interfaces` in mind, meaning, there are `structs` and methods attached to those `structs`, but there is no `interface` describing it. This is a perfectly valid approach when you don't need to mock/stub the method implementations provided by that `struct`, or there's only one implementation of the same 'contract'.

However, when these things are required we need to provide an `interface`.

Here's a small code snippet to demonstrate:

```go

type Person struct {
	Name string
}

func (p Person) Hello() string {
	return "Hello: " + p.Name
}

type Animal struct {
	Legs int
}

func (a Animal) Hello() string {
	return fmt.Sprintf("I have %d legs!", a.Legs)
}

func main() {
	p := Person{Name: "Fred"}
	a := Animal{Legs: 4}
	// ...
}
```

In this example both `Person` and `Animal` have the same `Hello()` method. If we wanted to store a list of both the `Person` and `Animal` `structs`, we would have to define it as:
```go
list := []interface{}{p,a}
```
But this way we lose the type information of the list elements.
This is where `interfaces` come in. Since both `Person` and `Animal` _implement_ a method with the same signature, we can extract that signature into an `interface` and use it for storing items in a list:
```go
type interface Hello {
	Hello() string
}
// ...
list := []Hello{p,a}
fmt.Printf("Person: [%v] Animal: [%v]\n", list[0].Hello(), list[1].Hello())
```

Awesome. Now let's say the `struct` you are extracting the `interface` from is a big one. A really big one. With lots and lots of methods spread out in different `.go` files. Creating such an `interface` manually would be very laborious.

This problem is itching to get an AST treatment. Let's get to it!

## AST to the rescue!

Let's break down the task at hand into smaller, digestable parts:

1. Scan the source code for all methods implemented on a specific `struct`
1. Collect all those methods (and their comments, for clarity)
1. Create a new file that will contain an `interface` with all the collected methods inside
1. ...
1. Profit?

{{<note "Note:">}}
Usually the `interface` doesn't contain all of the `struct` methods, but we'll leave the topics of abstraction and better code organization for another blog post.
{{</note>}}


### Scanning the source code for all `struct` methods

Here's a short piece of code that scans a folder of `.go` source code to first find a package by name and then search for all methods that are bound to the `struct` we're interested in.

```go
fset := token.NewFileSet()
// 1. scan source code folder
pkgs, err := parser.ParseDir(fset, folder, nil, parser.AllErrors|parser.ParseComments)
if err != nil {
	log.Fatalf("Unable to parse %s folder", folder)
}
// 2. find the required package by name
var appPkg *ast.Package
for _, pkg := range pkgs {
	if pkg.Name == pkgName {
		appPkg = pkg
		break
	}
}
if appPkg == nil {
	log.Fatalf("Unable to find package %s", pkgName)
}

// 3. find all methods that are bound to the specific struct
for _, file := range appPkg.Files {
	ast.Inspect(file, func(n ast.Node) bool {
		if fun, ok := n.(*ast.FuncDecl); ok {
			// 4. Validate that method is exported and has a receiver
			if fun.Name.IsExported() && fun.Recv != nil && len(fun.Recv.List) == 1 {
					// 5. Check that the receiver is actually the struct we want
					if r, rok := fun.Recv.List[0].Type.(*ast.StarExpr); rok && r.X.(*ast.Ident).Name == structName {
						// we found it!
					}
				}
			}

		}
		return true
	})
}
```

Steps 1 and 2 are pretty straightforward, the interesting bits start at step 3: For each file in the package, we execute `ast.Inspect` to get all the AST nodes. For every node that is actually a function (checked by `n.(*ast.FuncDecl)`), we check if that function is:

* Exported (we are not interested in private methods)
* Has a receiver (it's bound to a `struct`)
* Receiver's type matches the `struct` we are interested in

### Collecting functions and their comments

Now that we can get a `*ast.FuncDecl` (let's call it `fun`) for each function, we can collect all the information about it and reconstruct it:

1. Name: `fun.Name.Name`
2. Comments: `fun.Doc.List`
3. Parameters: `fun.Type.Params.List`
4. Return values: `fun.Type.Results.List`

### Generate the `interface` file

To generate the output `interface`, we'll use Go's `template` package. Let's define a simple template:

```go
const outputTemplate = `
// DO NOT EDIT, auto generated

package {{.Package}}

type {{.Name}} interface {
	{{.Content}}
}
`
```

And populate it:

```go
sort.Strings(funcs)
out := bytes.NewBufferString("")

t := template.Must(template.New("").Parse(outputTemplate))
err = t.Execute(out, map[string]interface{}{
	"Content": strings.Join(funcs, "\n"),
	"Name":    ifName,
	"Package": pkgName,
})
```

We're almost done! Our `interface` file is ready, but it's missing a crucial part - `imports`. Luckily, there is a package for that™ - https://pkg.go.dev/golang.org/x/tools/imports.

Let's give it whirl:

```go
formatted, err := imports.Process(outputFile, out.Bytes(), &imports.Options{Comments: true})
if err != nil {
	log.Panic(err)
}
err = ioutil.WriteFile(outputFile, formatted, 0644)
```

Voila! You have an `interface` file that contains all the methods implemented on the `struct`.

## `struct2interface`

The process I've described is a rather generic one, so to make it fully repeatable, I've extracted it into a separate CLI utility called `struct2interface`. It can be found at https://github.com/reflog/struct2interface.


## Conclusion

Once again, AST came to the rescue and saved us lots and lots of manual labor. Hurray! In the next post of this series, I'll describe how we combined our `layers` approach with AST to create a clean `opentracing` instrumentation we've started in the first part of these series.
