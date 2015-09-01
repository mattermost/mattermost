# Mattermost Style Guide

1. [Go](#go)
2. [Javascript](#javascript)
3. [React-JSX](#react-jsx)


## Go

All go code must follow the golang official [Style Guide](https://golang.org/doc/effective_go.html)

In addition all code must be run though the official go formatter tool [gofmt](https://golang.org/cmd/gofmt/)


## Javascript

Part of the build process is running ESLint. ESLint is the final authority on all style issues. PRs will not be accepted unless there are no errors or warnings running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](https://github.com/mattermost/platform/blob/master/web/react/.eslintrc.json)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

The following is an abridged version of the [Airbnb Javascript Style Guide](https://github.com/airbnb/javascript/blob/master/README.md#airbnb-javascript-style-guide-), with modifications. Anything that is unclear here follow that guide. If there is a conflict, follow what is said below. 

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
var x = 1;

// Incorrect
var x = 1
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

- Use template strings instead of concatenation.

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

Part of the build process is running ESLint. ESLint is the final authority on all style issues. PRs will not be accepted unless there are no errors or warnings running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](https://github.com/mattermost/platform/blob/master/web/react/.eslintrc.json)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

This is an abridged version of the [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react#airbnb-reactjsx-style-guide). Anything that is unclear here follow that guide. If there is a conflict, follow what is said below. 

### General

- Include only one React component per file.
- Use class \<name\> extends React.Component over React.createClass unless you need mixins
- CapitalCamelCase with .jsx extension for component filenames.
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



## React-JSX

Part of the build process is running ESLint. ESLint is the final authority on all style issues. PRs will not be accepted unless there are no errors or warnings running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](https://github.com/mattermost/platform/blob/master/web/react/.eslintrc.json)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

This is an abridged version of the [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react#airbnb-reactjsx-style-guide). Anything that is unclear here follow that guide. If there is a conflict, follow what is said below. 

### General

TESTTESTTESTTETSSTESTSETS
