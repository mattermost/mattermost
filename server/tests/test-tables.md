# Markdown Tables

Verify that all tables render as described. First row is boldface.

### Normal Tables

These tables use different raw text as inputs, but all three should render as the same table. 

#### Table 1

Raw text:

```
First Header  | Second Header
------------- | -------------
Content Cell  | Content Cell
Content Cell  | Content Cell
```

Renders as:

First Header  | Second Header
------------- | -------------
Content Cell  | Content Cell
Content Cell  | Content Cell

#### Table 2

Raw Text:

```
| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |
```

Renders as:

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

#### Table 3

Raw Text:

```
| First Header | Second Header           |
| ------------- | ----------- |
| Content Cell     | Content Cell|
| Content Cell        | Content Cell    |
```

Renders as:

| First Header | Second Header           |
| ------------- | ----------- |
| Content Cell     | Content Cell|
| Content Cell        | Content Cell    |

### Tables Containing Markdown

This table should contain A1: Strikethrough, A2: Bold, B1: Italics, B2: Dolphin emoticon.

| Column\Row | 1 | 2 |
| ------------- | ------------- |------------- |
| A | ~~Strikethrough~~ | **Bold** |
| B | _italics_  | :dolphin: |

### Table with Left, Center, and Right Aligned Columns

The left column should be left aligned, the center column centered and the right column should be right aligned. 

| Left-Aligned  | Center Aligned  | Right Aligned |
| :------------ |:---------------:| -----:|
| 1 | this text       |  $100 |
| 2 | is              |   $10 |
| 3 | centered        |    $1 |

### Table with Escaped Pipes

First row cells: single backslash, "asdf". Second row cells: "ab" , "a|d"

| \\ | asdf|
|----|-----|
| ab | a\|d|
