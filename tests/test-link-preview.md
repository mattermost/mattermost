# Link Preview Tests

Link previews should embed previews of the contents of a hyperlink from a message or comment in the center channel directly below the message or comment.

Post location variation: 

1. Post message in center channel with RHS closed (Expected: preview of first link renders under message) 
2. Post message in center channel with RHS open (Expected: preview of first link renders under message) 
3. Post comment in RHS (Expected: link preview does not render) 
4. View comment in center channel with RHS closed (Expected: preview of first link renders under message) 
5. View comment in center channel with RHS open (Expected: preview of first link renders under message) 
6. Search for post in RHS with link (Expected: no previews render in search results) 

Test the above variations with the below sample messages (e.g. 1-A, 2-B, 3-C, 4-D, etc.) 

```
#### A) News: The Globe and Mail 

Link 1 example: http://www.theglobeandmail.com/news/national/three-canadians-shortlisted-for-global-teacher-prize/article33429901/

Link 2 example: http://www.theglobeandmail.com/news/toronto/a-last-minute-guide-for-made-in-toronto-gifts/article33426221/

Link 3 example: http://www.theglobeandmail.com/opinion/as-2016-crashed-in-flames-libraries-were-the-last-good-place/article33427957/
```

```
#### B) Twitter

Link 1 example: https://twitter.com/mattermosthq/status/784382907896987648

Link 2 example: https://twitter.com/ArchieComics/status/813007703861841920

Link 3 example: https://twitter.com/ValiantComics/status/813066492187201536

```


```
#### C) Wikipedia 

Link 1 example: https://en.wikipedia.org/wiki/Olympus_Mons

Link 2 example: https://en.wikipedia.org/wiki/Climate_of_Mars#Effect_of_dust_storms

Link 3 example: https://en.wikipedia.org/wiki/Mars_Exploration_Rover

```

```
#### D) YouTube 

Link 1 example: https://www.youtube.com/watch?v=fDu1S-MMClw

Link 2 example: https://www.youtube.com/watch?v=GaCjjda5v1o

Link 3 example: https://www.youtube.com/watch?v=1Ui44_-N9y0

```


```
#### E) GitHub

Link 1 example: https://github.com/mattermost
```

```
#### F) Webpage: Techmeme 

Link 1 example: http://www.techmeme.com/
```

```
#### G) StackOverflow 

Link 1 example: http://stackoverflow.com/questions/36650437/using-mattermost-api-via-gitlab-oauth-as-an-end-user-with-username-and-password
```
