// Package toml is a TOML markup language parser.
//
// This version supports the specification as described in
// https://github.com/toml-lang/toml/blob/master/versions/en/toml-v0.4.0.md
//
// TOML Parsing
//
// TOML data may be parsed in two ways: by file, or by string.
//
//   // load TOML data by filename
//   tree, err := toml.LoadFile("filename.toml")
//
//   // load TOML data stored in a string
//   tree, err := toml.Load(stringContainingTomlData)
//
// Either way, the result is a Tree object that can be used to navigate the
// structure and data within the original document.
//
//
// Getting data from the Tree
//
// After parsing TOML data with Load() or LoadFile(), use the Has() and Get()
// methods on the returned Tree, to find your way through the document data.
//
//   if tree.Has("foo") {
//     fmt.Println("foo is:", tree.Get("foo"))
//   }
//
// Working with Paths
//
// Go-toml has support for basic dot-separated key paths on the Has(), Get(), Set()
// and GetDefault() methods.  These are the same kind of key paths used within the
// TOML specification for struct tames.
//
//   // looks for a key named 'baz', within struct 'bar', within struct 'foo'
//   tree.Has("foo.bar.baz")
//
//   // returns the key at this path, if it is there
//   tree.Get("foo.bar.baz")
//
// TOML allows keys to contain '.', which can cause this syntax to be problematic
// for some documents.  In such cases, use the GetPath(), HasPath(), and SetPath(),
// methods to explicitly define the path.  This form is also faster, since
// it avoids having to parse the passed key for '.' delimiters.
//
//   // looks for a key named 'baz', within struct 'bar', within struct 'foo'
//   tree.HasPath([]string{"foo","bar","baz"})
//
//   // returns the key at this path, if it is there
//   tree.GetPath([]string{"foo","bar","baz"})
//
// Note that this is distinct from the heavyweight query syntax supported by
// Tree.Query() and the Query() struct (see below).
//
// Position Support
//
// Each element within the Tree is stored with position metadata, which is
// invaluable for providing semantic feedback to a user.  This helps in
// situations where the TOML file parses correctly, but contains data that is
// not correct for the application.  In such cases, an error message can be
// generated that indicates the problem line and column number in the source
// TOML document.
//
//   // load TOML data
//   tree, _ := toml.Load("filename.toml")
//
//   // get an entry and report an error if it's the wrong type
//   element := tree.Get("foo")
//   if value, ok := element.(int64); !ok {
//       return fmt.Errorf("%v: Element 'foo' must be an integer", tree.GetPosition("foo"))
//   }
//
//   // report an error if an expected element is missing
//   if !tree.Has("bar") {
//      return fmt.Errorf("%v: Expected 'bar' element", tree.GetPosition(""))
//   }
//
// JSONPath-like queries
//
// The package github.com/pelletier/go-toml/query implements a system
// similar to JSONPath to quickly retrive elements of a TOML document using a
// single expression. See the package documentation for more information.
//
package toml
