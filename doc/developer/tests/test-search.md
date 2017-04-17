# Basic Search Testing
Tests for search, mentions, and hashtags.

### Testing Steps
1. Copy and paste the test post to a channel of your choice
2. Test to make sure that test post is a result for each search case
3. Test to make sure that the correct search term is highlighted for each search case

### Test Post
**The following post should be a result for the search cases found below**
```
Basic word testing: Hello world!
Emoji testing: :strawberry:
Markdown testing: ## Hello
Accent testing: Crème friache
Non-latin testing: 您好吗
Hashtag testing: #hello #world
Modifiers testing: @yourusername yourusername
```

### Search Cases
**Single word search**
- Search for the term `hello`

**Multiple word search**
- Search for the term `hello world`

**Phrase search**
- Search for the term `”hello world”`

**Emoji search**
- Search for the term `”strawberry”`

**Markdown search**
- Search for the term `hello`

**Accent search**
- Search for the term `crème friache`

**Non-latin search**
- Search for the term `您好*`

**Hashtag search**
- Search for the hashtag #hello by clicking on a hashtag in the center channel
- Search for the hashtag #hello by clicking on a hashtag in the RHS
- Search for the hashtag #hello by typing `#hello` into the search box
- Search for hashtags #hello #world by typing `#hello #world` into the search box

**In: modifier search**
- Search for the term `hello in:channel-you-posted-to`

**From: modifier search**
.- Search for the term `hello from:your-username`

**In: and from: modifier search**
- Search for the term `hello from:your-username in:channel-you-posted-to`

**Auto-complete search**
Type in `from:beginning-letters-of-your-username`
- Complete the search by clicking on the `from:your-username` auto-complete suggestion
- Complete the search by hitting Enter on the `from:your-username` auto-complete suggestion
- Complete the search by hitting Tab on the `from:your-username` auto-complete suggestion

**Recent mentions search**
- Search for recent mentions by clicking the icon next to the search bar
- Search for recent mentions by typing in `@yourusername` AND `your-username`
- Search for recent mentions by clicking on a mention of yourself in the center channel
- Search for recent mentions by clicking on a mention of yourself in the RHS
