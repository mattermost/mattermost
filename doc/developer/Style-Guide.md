# Mattermost Style Guide

1. [Go](#go)
2. [Javascript](#javascript)
3. [React-JSX](#react-jsx)


## Go

All go code must follow the golang official [Style Guide](https://golang.org/doc/effective_go.html)

In addition all code must be run though the official go formatter tool [gofmt](https://golang.org/cmd/gofmt/)


## Javascript

Part of the build process is running ESLint. ESLint is the final authority on all style issues. PRs will not be accepted unless there are no errors running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](/web/react/.eslintrc)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

You can run eslint using the makefile by using `make check`

The following is a subset of what ESLint checks for. ESLint is always the authority. 

### Whitespace

- Indentation is four spaces.
- Use a space before the leading brace.
- Use one space between the comma and the next argument in a bracketed list. No other space.
- Use whitespace to make code more readable.
- Do not use more than one newline to separate code blocks. 
- Do not use a newline as the first line of a function

```javascript
// Correct
function myFunction(parm1, parm2) {
    stuff...;
  
    morestuff;
}

// Incorrect
function myFunction ( parm1, parm2 ){
  stuff...;
    
    
  morestuff;
}

```

### Semicolons

- You must use them always.

```javascript
// Correct
let x = 1;

// Incorrect
let x = 1
```

### Variables

- Declarations must always use var, let or const.
- Prefer let or const over var.
- camelCase for all variable names.

```javascript
// Correct
let myVariable = 4;

// OK
var myVariable = 4;

// Incorrect
myVariable = 4;
var my_variable = 4;
```

### Blocks

- Braces must be used on all blocks.
- Braces must start on the same line as the statement starting the block.
- Else and else if must be on the same line as the if block closing brace.

```javascript
// Correct
if (something) {
    stuff...;
} else if (otherthing) {
    stuff...;
}

// Incorrect
if (something)
{
    stuff...;
}
else
{
    stuff...;
}

// Incorrect
if (something) stuff...;
if (something)
    stuff...;

```

### Strings

- Use of template strings is preferred instead of concatenation.

```javascript
// Correct
function getStr(stuff) {
    return "This is the ${stuff} string";
}

// Incorrect
function wrongGetStr(stuff) {
    return "This is the " + stuff + " string";
}
```

## React-JSX

Part of the build process is running ESLint. ESLint is the final authority on all style issues. PRs will not be accepted unless there are no errors running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](/web/react/.eslintrc)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

You can run eslint using the makefile by using `make check`

The following is a subset of what ESLint checks for. ESLint is always the authority. 

### General

- Include only one React component per file.
- Use class \<name\> extends React.Component over React.createClass unless you need mixins
- Filenames should be the component name.

### Alignment

- Follow alignment styles shown below:
```xml
// Correct
<Tag
    propertyOne="1"
    propertyTwo="2"
>
  <Child />
</Tag>

// Correct
<Tag propertyOne="1" />
```

### Naming

- Property names use camelCase.
- React component names use CapitalCamelCase.
- Do not use an underscore for internal methods in a react component. 

```xml
// Correct
<ReactComponent propertyOne="value" />
```
