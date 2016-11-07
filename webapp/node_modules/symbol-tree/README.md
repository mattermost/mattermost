symbol-tree
===========
Turn any collection of objects into its own efficient tree or linked list using `Symbol`.

This library has been designed to provide an efficient backing data structure for DOM trees. You can also use this library as an efficient linked list. Any meta data is stored on your objects directly, which ensures any kind of insertion or deletion is performed in constant time. Because an ES6 `Symbol` is used, the meta data does not interfere with your object in any way.

Node.js 4+, io.js and modern browsers are supported.

Example
-------
A linked list:

```javascript
const SymbolTree = require('symbol-tree');
const tree = new SymbolTree();

let a = {foo: 'bar'}; // or `new Whatever()`
let b = {foo: 'baz'};
let c = {foo: 'qux'};

tree.insertBefore(b, a); // insert a before b
tree.insertAfter(b, c); // insert c after b

console.log(tree.nextSibling(a) === b);
console.log(tree.nextSibling(b) === c);
console.log(tree.previousSibling(c) === b);

tree.remove(b);
console.log(tree.nextSibling(a) === c);
```

A tree:

```javascript
const SymbolTree = require('symbol-tree');
const tree = new SymbolTree();

let parent = {};
let a = {};
let b = {};
let c = {};

tree.prependChild(parent, a); // insert a as the first child
tree.appendChild(parent,c ); // insert c as the last child
tree.insertAfter(a, b); // insert b after a, it now has the same parent as a

console.log(tree.firstChild(parent) === a);
console.log(tree.nextSibling(tree.firstChild(parent)) === b);
console.log(tree.lastChild(parent) === c);

let grandparent = {};
tree.prependChild(grandparent, parent);
console.log(tree.firstChild(tree.firstChild(grandparent)) === a);
```

See [api.md](api.md) for more documentation.

Testing
-------
Make sure you install the dependencies first:

    npm install

You can now run the unit tests by executing:

    npm test

The line and branch coverage should be 100%.