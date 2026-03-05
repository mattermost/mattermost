---
title: Writing a Blog Post
heading: "Writing a Blog Post at Mattermost"
description: "Blog posts are a great way to share your experience with the community. Follow these guidelines when writing a blog post for Mattermost."
date: 2019-02-06T14:28:35-05:00
weight: 105
---

Been to a conference recently? Worked on something cool? Got something else Mattermost-related you want to post about? Writing a blog post is a great way to share your experience with the community. 

Blog posts can cover a wide range of topics, such as:

- Addressing a customer-facing problem
- Describing an experience with Mattermost/your Mattermost implementation 
- Sharing information about cool tech 
- Sharing feedback on an interesting talk or conference 
- Part of a Hackathon project
- A Help Wanted ticket
- A knowledge-share and call for feedback/community engagement
- A discussion of a specific problem or improvement that you worked on
- A breakdown of a new process or technology you’re using


Once you've got the topic in mind - what it's about, what you want to achieve with the post, and what the next steps are - it’s sometimes helpful to start writing the conclusion and expand to your jumping off point to introduce your topic/idea/discovery draws.

Make a note of your intended audience, so you can decide whether to use very technical terms/jargon, or spend time unpacking terminology.


Structuring Your Blog Post
--------------------------

These are some ideas of the parts of a blog post. They’re not mandatory and not all blog posts will include every aspect. What works for some posts won’t work for others. 

- **Introduction/Overview:** An opening paragraph detailing the goal of the post and the technologies/processes that were used. For example: “Monitoring is an essential part of our organization. When we started, we were using “x” which gave us insight into “y”. With our growth as a company, we need more insights into areas that “x” can’t handle, so we decided to switch to “a” and “b””.  
- **Problem/Solution/Situation:** Detail the problem or scenario that sparked the blog post. For example, “Our monitoring tools weren’t giving us the insight we needed, and were costing a lot of money. We decided to try solve this by using multiple tools that could be used or on standby as needed. This saves money.” 
- **Environment:** Plugins, software, specific configurations/services used. 
- **Steps:** The process followed to get from conception to implementation, for example, how the monitoring was configured initially, and the new configuration. Include code samples and/or screenshots. How long it took to build a database/history. What steps were taken to create a good alert system. 
- **Samples:** Code samples are often useful, as are screenshots/animated GIFs if a complex process is being demonstrated. 
- **Benefits:** The benefits of the exercise or process of the blog post - man-hours saved, budget target achieved, lower overheads, etc. 
- **Conclusion:** Whether the exercise or process has long-term potential, whether it’s still in place, or whether it was a failure. 

Some popular blogs that are worth reading include:
- https://blog.golang.org/
- https://dave.cheney.net/
- https://technology.riotgames.com/
- https://www.freecodecamp.org/news/
- https://alistapart.com/

The [/site/content/blog/](https://github.com/mattermost/mattermost-developer-documentation/tree/master/site/content/blog) folder also has some good examples.

Writing Your Blog Post
----------------------

The steps below outline the process involved in creating the blog post file from a cloned repo, and then submitting the PR.  

1. Clone https://github.com/mattermost/mattermost-developer-documentation.
2. Create a new .md file in the [/site/content/blog/](https://github.com/mattermost/mattermost-developer-documentation/tree/master/site/content/blog) folder.
  - Use `YYYY-MM-DD-<your-blog-post-title>.md` as the filename.

3. Paste this template into your file

    ```
    ---
    title: <user readable title of your blog post, e.g. My Blog Post>
    description: "<brief description of the post less than 160 characters in length>"
    heading: "<the heading that appears at the top of the page content>"
    slug: <URL name of your blog post, e.g. my-blog-post>
    date: YYYY-MM-DDT12:00:00-04:00
    author: <FirstName LastName>
    github: <your GitHub username>
    community: <your community.mattermost.com username>
    ---

    <intro to blog post>

    #### <some heading>
    <some content>

    #### <another heading>
    <some more content>
    ```

4. Write your blog post.
5. (Optional) If you wrote the blog post with someone else, you can also add a second author by adding `author_2`, `github_2` and `community_2` to the [front matter](https://gohugo.io/content-management/front-matter).
6. Submit a pull request to https://github.com/mattermost/mattermost-developer-documentation and assign two dev reviews and an editor review from @amyblais or @justinegeffen.
7. Once merged it should show up on [developers.mattermost.com/blog](https://developers.mattermost.com/blog) within 10-15 minutes. When it shows up, post about it in the Developers channel on community.mattermost.com.
