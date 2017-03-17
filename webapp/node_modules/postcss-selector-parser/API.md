# API Documentation

*Please use only this documented API when working with the parser. Methods
not documented here are subject to change at any point.*

## `parser` function

This is the module's main entry point.

```js
var parser = require('postcss-selector-parser');
```

### `parser([transform])`

Creates a new `processor` instance

```js
var processor = parser();

// or, with optional transform function
var transform = function (selectors) {
    selectors.eachUniversal(function (selector) {
        selector.remove();
    });
};

var processor = parser(transform)

// Example
var result = processor.process('*.class').result;
// => .class
```

[See processor documentation](#processor)

Arguments:

* `transform (function)`: Provide a function to work with the parsed AST.

### `parser.attribute([props])`

Creates a new attribute selector.

```js
parser.attribute({attribute: 'href'});
// => [href]
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.className([props])`

Creates a new class selector.

```js
parser.className({value: 'button'});
// => .button
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.combinator([props])`

Creates a new selector combinator.

```js
parser.combinator({value: '+'});
// => +
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.comment([props])`

Creates a new comment.

```js
parser.comment({value: '/* Affirmative, Dave. I read you. */'});
// => /* Affirmative, Dave. I read you. */
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.id([props])`

Creates a new id selector.

```js
parser.id({value: 'search'});
// => #search
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.nesting([props])`

Creates a new nesting selector.

```js
parser.nesting();
// => &
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.pseudo([props])`

Creates a new pseudo selector.

```js
parser.pseudo({value: '::before'});
// => ::before
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.root([props])`

Creates a new root node.

```js
parser.root();
// => (empty)
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.selector([props])`

Creates a new selector node.

```js
parser.selector();
// => (empty)
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.string([props])`

Creates a new string node.

```js
parser.string();
// => (empty)
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.tag([props])`

Creates a new tag selector.

```js
parser.tag({value: 'button'});
// => button
```

Arguments:

* `props (object)`: The new node's properties.

### `parser.universal([props])`

Creates a new universal selector.

```js
parser.universal();
// => *
```

Arguments:

* `props (object)`: The new node's properties.

## Node types

### `node.type`

A string representation of the selector type. It can be one of the following;
`attribute`, `class`, `combinator`, `comment`, `id`, `nesting`, `pseudo`,
`root`, `selector`, `string`, `tag`, or `universal`. Note that for convenience,
these constants are exposed on the main `parser` as uppercased keys. So for
example you can get `id` by querying `parser.ID`.

```js
parser.attribute({attribute: 'href'}).type;
// => 'attribute'
```

### `node.parent`

Returns the parent node.

```js
root.nodes[0].parent === root;
```

### `node.toString()`, `String(node)`, or `'' + node`

Returns a string representation of the node.

```js
var id = parser.id({value: 'search'});
console.log(String(id));
// => #search
```

### `node.next()` & `node.prev()`

Returns the next/previous child of the parent node.

```js
var next = id.next();
if (next && next.type !== 'combinator') {
    throw new Error('Qualified IDs are not allowed!');
}
```

### `node.replaceWith(node)`

Replace a node with another.

```js
var attr = selectors.first.first;
var className = parser.className({value: 'test'});
attr.replaceWith(className);
```

Arguments:

* `node`: The node to substitute the original with.

### `node.remove()`

Removes the node from its parent node.

```js
if (node.type === 'id') {
    node.remove();
}
```

### `node.clone()`

Returns a copy of a node, detached from any parent containers that the
original might have had.

```js
var cloned = parser.id({value: 'search'});
String(cloned);

// => #search
```

### `node.spaces`

Extra whitespaces around the node will be moved into `node.spaces.before` and
`node.spaces.after`. So for example, these spaces will be moved as they have
no semantic meaning:

```css
      h1     ,     h2   {}
```

However, *combinating* spaces will form a `combinator` node:

```css
h1        h2 {}
```

A `combinator` node may only have the `spaces` property set if the combinator
value is a non-whitespace character, such as `+`, `~` or `>`. Otherwise, the
combinator value will contain all of the spaces between selectors.

### `node.source`

An object describing the node's start/end, line/column source position.

Within the following CSS, the `.bar` class node ...

```css
.foo,
  .bar {}
```

... will contain the following `source` object.

```js
source: {
    start: {
        line: 2,
        column: 3
    },
    end: {
        line: 2,
        column: 6
    }
}
```

### `node.sourceIndex`

The zero-based index of the node within the original source string.

Within the following CSS, the `.baz` class node will have a `sourceIndex` of `12`.

```css
.foo, .bar, .baz {}
```

## Container types

The `root`, `selector`, and `pseudo` nodes have some helper methods for working
with their children.

### `container.nodes`

An array of the container's children.

```js
// Input: h1 h2
selectors.at(0).nodes.length   // => 3
selectors.at(0).nodes[0].value // => 'h1'
selectors.at(0).nodes[1].value // => ' '
```

### `container.first` & `container.last`

The first/last child of the container.

```js
selector.first === selector.nodes[0];
selector.last === selector.nodes[selector.nodes.length - 1];
```

### `container.at(index)`

Returns the node at position `index`.

```js
selector.at(0) === selector.first;
selector.at(0) === selector.nodes[0];
```

Arguments:

* `index`: The index of the node to return.

### `container.index(node)`

Return the index of the node within its container.

```js
selector.index(selector.nodes[2]) // => 2
```

Arguments:

* `node`: A node within the current container.

### `container.length`

Proxy to the length of the container's nodes.

```js
container.length === container.nodes.length
```

### `container` Array iterators

The container class provides proxies to certain Array methods; these are:

* `container.map === container.nodes.map`
* `container.reduce === container.nodes.reduce`
* `container.every === container.nodes.every`
* `container.some === container.nodes.some`
* `container.filter === container.nodes.filter`
* `container.sort === container.nodes.sort`

Note that these methods only work on a container's immediate children; recursive
iteration is provided by `container.walk`.

### `container.each(callback)`

Iterate the container's immediate children, calling `callback` for each child.
You may return `false` within the callback to break the iteration.

```js
var className;
selectors.each(function (selector, index) {
    if (selector.type === 'class') {
        className = selector.value;
        return false;
    }
});
```

Note that unlike `Array#forEach()`, this iterator is safe to use whilst adding
or removing nodes from the container.

Arguments:

* `callback (function)`: A function to call for each node, which receives `node`
  and `index` arguments.

### `container.walk(callback)`

Like `container#each`, but will also iterate child nodes as long as they are
`container` types.

```js
selectors.walk(function (selector, index) {
    // all nodes
});
```

Arguments:

* `callback (function)`: A function to call for each node, which receives `node`
  and `index` arguments.

This iterator is safe to use whilst mutating `container.nodes`,
like `container#each`.

### `container.walk` proxies

The container class provides proxy methods for iterating over types of nodes,
so that it is easier to write modules that target specific selectors. Those
methods are:

* `container.walkAttributes`
* `container.walkClasses`
* `container.walkCombinators`
* `container.walkComments`
* `container.walkIds`
* `container.walkNesting`
* `container.walkPseudos`
* `container.walkTags`
* `container.walkUniversals`

### `container.split(callback)`

This method allows you to split a group of nodes by returning `true` from
a callback. It returns an array of arrays, where each inner array corresponds
to the groups that you created via the callback.

```js
// (input) => h1 h2>>h3
var list = selectors.first.split((selector) => {
    return selector.type === 'combinator';
});

// (node values) => [['h1', ' '], ['h2', '>>'], ['h3']]
```

Arguments:

* `callback (function)`: A function to call for each node, which receives `node`
  as an argument.

### `container.prepend(node)` & `container.append(node)`

Add a node to the start/end of the container. Note that doing so will set
the parent property of the node to this container.

```js
var id = parser.id({value: 'search'});
selector.append(id);
```

Arguments:

* `node`: The node to add.

### `container.insertBefore(old, new)` & `container.insertAfter(old, new)`

Add a node before or after an existing node in a container:

```js
selectors.walk(function (selector) {
    if (selector.type !== 'class') {
        var className = parser.className({value: 'theme-name'});
        selector.parent.insertAfter(selector, className);
    }
});
```

Arguments:

* `old`: The existing node in the container.
* `new`: The new node to add before/after the existing node.

### `container.removeChild(node)`

Remove the node from the container. Note that you can also use
`node.remove()` if you would like to remove just a single node.

```js
selector.length // => 2
selector.remove(id)
selector.length // => 1;
id.parent       // undefined
```

Arguments:

* `node`: The node to remove.

### `container.removeAll()` or `container.empty()`

Remove all children from the container.

```js
selector.removeAll();
selector.length // => 0
```

## Root nodes

A root node represents a comma separated list of selectors. Indeed, all
a root's `toString()` method does is join its selector children with a ','.
Other than this, it has no special functionality and acts like a container.

### `root.trailingComma`

This will be set to `true` if the input has a trailing comma, in order to
support parsing of legacy CSS hacks.

## Selector nodes

A selector node represents a single compound selector. For example, this
selector string `h1 h2 h3, [href] > p`, is represented as two selector nodes.
It has no special functionality of its own.

## Pseudo nodes

A pseudo selector extends a container node; if it has any parameters of its
own (such as `h1:not(h2, h3)`), they will be its children. Note that the pseudo
`value` will always contain the colons preceding the pseudo identifier. This
is so that both `:before` and `::before` are properly represented in the AST.

## Attribute nodes

### `attribute.quoted`

Returns `true` if the attribute's value is wrapped in quotation marks, false if it is not.
Remains `undefined` if there is no attribute value.

```css
[href=foo] /* false */
[href='foo'] /* true */
[href="foo"] /* true */
[href] /* undefined */
```

### `attribute.raws.unquoted`

Returns the unquoted content of the attribute's value.
Remains `undefined` if there is no attribute value.

```css
[href=foo] /* foo */
[href='foo'] /* foo */
[href="foo"] /* foo */
[href] /* undefined */
```

### `attribute.raws.insensitive`

If there is an `i` specifying case insensitivity, returns that `i` along with the whitespace
around it.

```css
[id=Bar i ] /* " i " */
[id=Bar   i  ] /* "   i  " */
```

## `processor`

### `process(cssText, [options])`

Processes the `cssText`, returning the parsed output

```js
var processor = parser();

var result = processor.process(' .class').result;
// =>  .class

// To have the parser normalize whitespace values, utilize the options
var result = processor.process('  .class  ', {lossless: false}).result;
// => .class
```

Arguments:

* `cssText (string)`: The css to be parsed.
* `[options] (object)`: Process options

Options:

* `loseless (boolean)`: false to normalize the selector whitespace, defaults to true
