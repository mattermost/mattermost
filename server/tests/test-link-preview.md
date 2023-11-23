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
#### A) No link preview

Link 1 example: https://en.wikipedia.org/wiki/Olympus_Mons

Link 2 example: http://www.techmeme.com/

Link 3 example: https://about.gitlab.com/
```

```
#### B) Link preview without an image

Link 1 example: https://coveralls.io/builds/9818822/source?filename=app%2Faudit.go
```

```
#### C) Link preview with image in top right corner

Link 1 example: http://www.theglobeandmail.com/news/national/three-canadians-shortlisted-for-global-teacher-prize/article33429901/

Link 2 example: https://twitter.com/ArchieComics/status/813007703861841920

Link 3 example: https://github.com/mattermost

Link 4 example: http://stackoverflow.com/questions/36650437/using-mattermost-api-via-gitlab-oauth-as-an-end-user-with-username-and-password
```

```
#### D) Link preview with image at the bottom

If "Account Settings > Display > Default appearance of image link previews" is set to "Collapsed", you must click the expand arrows to display the image.

Link 1 example: https://www.yahoo.com/news/panasonic-unveils-solar-roof-may-212400917.html

Link 2 example: https://mattermost.com

```
