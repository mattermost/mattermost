# Search Testing

### Basic Search Testing

This post is used by the core team to test search. It should be returned for the test cases for search, with proper highlighting in the search results. 

**Basic word search:** Hello world!  
**Emoji search:** :strawberry:  
**Accent search:** Crème fraîche  
**Non-latin search:**  
您好吗  
您好  
**Email search:** person@domain.org  
**Link search:** www.dropbox.com  
**Markdown search:**  
##### Hello  
```  
Hello  
```  
`Hello`  


### Hashtags:

Click on the linked hashtags below, and confirm that the search results match the linked hashtags. Confirm that the highlighting in the search results is correct. 

#### Basic Hashtags

#hello #world

#### Hashtags containing punctuation:

*Note: Make a separate post containing only the word “hashtag”, and confirm the hashtags below do not return the separate post.*

#hashtag #hashtag-dash #hashtag_underscore #hashtag.dot

#### Punctuation following a hashtag:

#colon: #slash/ #backslash\ #percent% #dollar$ #semicolon; #ampersand&  #bracket( #bracket) #lessthan< #greaterthan> #dash- #plus+ #equals=  #caret^ #hashtag# #asterisk* #verticalbar| #invertedquestion¿ #atsign@ #quote” #apostrophe' #curlybracket{ #curlybracket} #squarebracket[ #squarebracket] 

#### Markdown surrounding a hashtag:

*#markdown* **#markdown** ~~#markdown~~
##### #markdown

#### Accents and non-Latin characters in a hashtag:

#crèmeglacée #테스트
