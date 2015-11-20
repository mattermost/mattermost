# Markdown Help

Markdown makes it easy to format messages. Type a message as you normally would, and use these rules to render it with special formatting. 

## Text Style: 

You can use either `_` or `*` around a word to make it italic. Use two to make it bold.

* `_italics_` renders as _italics_
* `**bold**` renders as **bold**
* `**_bold-italic_**` renders as **_bold-italics_**
* `~~strikethrough~~` renders as ~~strikethrough~~

## Code Block: 

Create a code block by indenting each line by four spaces, or by placing ``` on the line above and below your code. 

Example:

    ```
    code block
    ```

Renders as: 
```
code block
```

### Syntax Highlighting

To add syntax highlighting, type the language to be highlighted after the ``` at the beginning of the code block. 

Supported languages are:
`diff, apache, makefile, http, json, markdown, javascript, css, nginx, objectivec, python, xml, perl, bash, php, coffee (CoffeeScript), cs (C#), cpp (C++), sql, go, ruby, java, ini, latex`

Example:

    ``` go
    package main
    import "fmt"
    func main() {
	    fmt.Println("Hello, 世界")
    }
    ```

Renders as: 
``` go
package main
import "fmt"
func main() {
	fmt.Println("Hello, 世界")
}
```

## In-line Code:

Create in-line monospaced font by surrounding it with backticks. 
```
`monospace`
```
Renders as: `monospace`.

## Links: 

Create labeled links by putting the desired text in square brackets and the associated link in normal brackets. 

`[Check out Mattermost!](www.mattermost.com)`

Renders as: [Check out Mattermost!](www.mattermost.com)

## In-line Images

Create in-line images using an `!` followed by the alt text in square brackets and the link in normal brackets. Add hover text by placing it in quotes after the link.
```
![alt text](link "hover text")

and

[![Build Status](https://travis-ci.org/mattermost/platform.svg?branch=master)](https://travis-ci.org/mattermost/platform) [![Github](https://assets-cdn.github.com/favicon.ico)](https://github.com/mattermost/platform)
```
Renders as: 

![alt text](link "hover text")

and

[![Build Status](https://travis-ci.org/mattermost/platform.svg?branch=master)](https://travis-ci.org/mattermost/platform) [![Github](https://assets-cdn.github.com/favicon.ico)](https://github.com/mattermost/platform)

## Emojis

Check out a full list of emojis [here](http://www.emoji-cheat-sheet.com/).

```
:smile: :+1: :sheep:
```
Renders as:
:smile: :+1: :sheep:

## Lines:

Create a line by using three `*`, `_`, or `-`.

`***` renders as: 
***

## Block quotes:

Create block quotes using `>`.

`> block quotes` renders as:
> block quotes

## Lists: 

Create a list by using `*` or `-` as bullets. Indent a bullet point by adding two spaces in front of it.
```
* list item one
* list item two
  * item two sub-point
```
Renders as: 
* list item one
* list item two
  * item two sub-point

Make it an ordered list by using numbers instead:
```
1. Item one
2. Item two
```
Renders as: 
1. Item one
2. Item two

## Tables: 

Create a table by placing a dashed line under the header row and separating the columns with a pipe `|`. (The columns don’t need to line up exactly for it to work). Choose how to align table columns by including colons `:` within the header row.
```
| Left-Aligned  | Center Aligned  | Right Aligned |
| :------------ |:---------------:| -----:|
| Left column 1 | this text       |  $100 |
| Left column 2 | is              |   $10 |
| Left column 3 | centered        |    $1 |
```

Renders as:

| Left-Aligned  | Center Aligned  | Right Aligned |
| :------------ |:---------------:| -----:|
| Left column 1 | this text       |  $100 |
| Left column 2 | is              |   $10 |
| Left column 3 | centered        |    $1 |

## Headings: 

Make a heading by typing # and a space before your title. For smaller headings, use more #’s. 
```
# Large heading
## Smaller heading
### Even smaller heading
```
Renders as: 
# Large Heading
## Smaller Heading
### Even smaller heading

Alternatively, for the large heading you can underline the text using `===`. For the smaller heading you can underline using `---`
```
Large Heading
=============

Smaller Heading
--------------
```
Renders as:
Large Heading
=============

Smaller Heading
--------------
