# Mattermost Style Guide

1. [GO](#go)
2. [Javascript](#javascript)
3. [React-JSX](#react-jsx)


## Go

All go code must follow the golang official [Style Guide](https://golang.org/doc/effective_go.html)

In addition all code must be run though the official go formater tool [gofmt](https://golang.org/cmd/gofmt/)


## Javascript

Part of the buld process is running ESLint. ESLint is the final athority on all style issues. PRs will not be accepted unless there are no errors or warnings running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](https://github.com/mattermost/platform/blob/master/web/react/.eslintrc.json)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

The following is an abriged version of the [Airbnb Javascript Style Guide](https://github.com/airbnb/javascript/blob/master/README.md#airbnb-javascript-style-guide-), with modifications. Anything that is unclear here follow that guide. If there is a conflict, follow what is said below. 

### Whitespace

- Indentaiton is four spaces
- Use a space before the leading brace
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

- You must use them always

```javascript
// Correct
var x = 1;

// Incorrect
var x = 1
```

### Variables

- Declarations must always use var, let or const.
- Perfer let or const over var.

```javascript
// Correct
let x = 4;

// OK
var x = 4;

// Incorrect
x = 4;
```

### Blocks

- Braces must be used on all multi-line blocks.
- Braces must start on the same line as the statment starting the block.
- Else and else if must be on the same line as the if block closing brace.

```javascript
// Correct
if (somthing) {
    stuff...;
} else if (otherthing) {
    stuff...;
}

// Incorrect
if (somthing)
{
    stuff...;
}
else
{
    stuff...;
}

// Incorrect
if (somthing) stuff...;
if (somthing)
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

Part of the buld process is running ESLint. ESLint is the final athority on all style issues. PRs will not be accepted unless there are no errors or warnings running ESLint. The ESLint configuration file can be found in: [web/react/.eslintrc](https://github.com/mattermost/platform/blob/master/web/react/.eslintrc.json)

Instructions on how to use ESLint with your favourite editor can be found here: [http://eslint.org/docs/user-guide/integrations](http://eslint.org/docs/user-guide/integrations)

This is an abriged version of the [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react#airbnb-reactjsx-style-guide). Anything that is unclear here follow that guide. If there is a conflict, follow what is said below. 

### General

- Include only one React component per file.
- Use class \<name\> extends React.Componet over React.createClass unless you need mixins
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

// Correct
<Tag propertyOne="1" />
```

### Nameing

- Property names use camelCase.
- React component names use CapitalCamelCase.
- Do not use an understore for internal methods in a react component. 

```xml
// Correct
<ReactComponent propertyOne="value" />
```
