# Documentation Conventions

The most important thing about documentation is getting it done and out to the community. 

After that, we can work on upgrading the quality of documentation. The below chart summarizes the different levels of documentation and how the quality gates are applied. 

_Note: Documentation Guidelines are new, and iterating. Documentation has started to balloon and this is our attempt at reducing ambiguity and increasing consistency, but the conventions here are very open to discussion._

| Stars | Benchmark                       | Timeline                        |
|:-------------|:--------------------------------|:--------------------------------|
| 1 | Documentation is correct. | First draft checked in by developer. Okay to ship in first release of new feature. |
| 2 | Documentation a) follows all objective formatting criteria, b) is tested by someone other than the author, c) satisfies above. | First edit under objective rules. Required before second release cycle with this feature included. |
| 3 | Documentation a) follows all subjective style criteria, b) is reviewed and edited by someone who has previously authored 3-star documentation, and c)  satisfies above. | Second edit under subjective rules. Required before third release cycle with this feature included |
| 4 | Documentation a) has received at least 1 edit due to user feedback, b) has received at least one unprompted compliment from user community on quality, c) satisfies above. | Additional edits to refine documentation based on user feedback |

## 1-Star Requirements: Correctness

### List precise dependencies 

1. Be explicit about what specific dependencies have been tested as part of an installation procedure. 
2. Be explicit about assumptions of compatibility on systems that have not been tested. 
3. Do not claim the system works on later versions of a platform if backwards compatibility is not a priority for the dependency (It's okay to say Chrome version 43 and higher, but not Python 2.6 and higher, because Python 3.0 is explicitly incompatible with previous versions). 

#### Correct

----
This procedure works on an Ubuntu 14.04 server with Python 2.6 installed and should work on compatible Linux-based operating systems and compatible versions of Python. 

----
#### Incorrect

----
This procedure works on Linux servers running Python.  

also: 

This procedure works on Linux servers running Python 2.6 and higher. 

----
## 2-Star Requirements: Objective Formatting Checklist 

### Use headings  

Headings in markdown provide anchors that can be used to easily reference sub-sections of long pieces of documentation. This is preferable to just numbering sections without headings. 

##### Correct: 

---- 
##### Step 1: Add a heading
This makes things easier to reference via hyperlinks
##### Step 2: Link to headings
So things are easier to find

---- 
##### Incorrect: 

---- 
**Step 1: Add a heading**
This makes things easier to reference via hyperlinks
**Step 2: Link to headings**
So things are easier to find
---- 

### Use appropriate heading case

Cases in headings may vary depending on usage.

#### When to use Title Case

H1, H2, H3 headings should be "Title Case" and less than four words, except if a colon is used, then four words per segment separated by the colon. 

These large headings are typically shorter and help with navigating large documents

#### When to use sentence case

H3, H4, H5 headings should be "Sentence case" and can be any length. 

These headers are smaller and used to summarize sections. H3 can be considered either a large or small heading. 

These conventions are new, so there's flexibility around them, when you're not sure, consider the convention here as default.

### Sub-section headings should end with a colon

For readability and clear layout, end a sub-section heading with a colon

##### Correct: 

---- 

Service Based: 

- [AWS Elastic Beanstalk Setup](https://github.com/mattermost/platform/blob/master/doc/install/Amazon-Elastic-Beanstalk.md)
 
---- 
##### Incorrect: 

---- 

Service Based

- [AWS Elastic Beanstalk Setup](https://github.com/mattermost/platform/blob/master/doc/install/Amazon-Elastic-Beanstalk.md)
 

---- 

### One instruction per line

It's easy to miss instructions when they're compounded. Have only one instruction per line, so documentation looks more like a checklist. 

A support person should be able to say "Did you complete step 7?" instead of "Did you complete the second part of step 7 after doing XXX?"

##### Correct: 

---- 

6. For **Predefined configuration** look under **Generic** and select **Docker**. 
   7. For **Environment type** select **Single instance**

---- 

##### Incorrect: 

---- 

6. For **Predefined configuration** look under **Generic** and select **Docker**. For **Environment type** select **Single instance**

---- 

### End Lists Consistently

Full sentences in lists should end with proper punctuation. If one point in a bulleted list or numbered list ends with a period, end all points in the list with a period. If all points in the list are fragments, use no end punctuation.

##### Correct

----
- This is an example of a bullet point that ends with a period.

----
##### Incorrect

----
- Example of an incorrect period at the end of a bullet point.

----
### Avoid Passive Phrases

Examples of passive phrases include "have", "had", "was", "can be", "has been" and documentation is shorter and clearer without them. 

##### Correct

----
This software **runs** on any server that supports Python. 

----
##### Incorrect

----
This software **can be run** on any server that supports Python. 

----
## 3-Star Requirements: Subjective Style Guidelines

### Be Concise 

Try to use fewer words when possible. 

##### Correct: 

----
This integration posts [issue](http://doc.gitlab.com/ee/web_hooks/web_hooks.html#issues-events), [comment](http://doc.gitlab.com/ee/web_hooks/web_hooks.html#comment-events) and [merge request](http://doc.gitlab.com/ee/web_hooks/web_hooks.html#merge-request-events) events from a GitLab repository into specific Mattermost channels by formatting output from [GitLab's outgoing webhooks](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md) to [Mattermost's incoming webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md).

----
##### Incorrect: 

----
This integration makes use of GitLab's outgoing webhooks and Mattermost's incoming webhooks to post GitLab events into Mattermost. You can find GitLab's outgoing webhooks described [here](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md) and Mattermost's incoming webhooks described [here](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md).

----

### Use appropriate emphasis

Mention Clickable Controls in **Bold**, Sections and Setting Names in *Italics*, and Key Strokes in `pre-formatted text`.

To make it clear and consistent across documentation on how we describe controls that a user is asked to manipulate, we have a number of guidelines:

**Bold**  
- Please **bold** the names of controls you're asking users to click. The text that is bolded should match the label of the control in the user interface. Do not format these references with _italics_, ALL-CAPS or `pre-formatted text`.
- Use `>` to express a series of clicks, for example clicking on **Button One** > **Button Two** > **Button Three**. 
- If a button might be difficult to find, give a hint about its location _before_ mentioning the name of the control (this helps people find the hint before they start searching, if the see the name of the button first, they might not continue reading to find the hint before starting to look). 

***Italics***  
- Please *italicize* setting names or section headings that identify that the user is looking in the correct area. The text that is italicized should match the name of the setting or section in the user interface.  
- It is helpful to use italics to guide the user to the correct area before mentioning a clickable action in bold.

**`pre-formatted text`**  
- Please use `pre-formatted text` to identify when a user must enter key strokes or paste text into an input box.

#### Correct

----
Type `mattermost-integration-giphy` in the *repo-name* field, then click **Search** and then the **Connect** button once Heroku finds your repository

----
#### Incorrect

----
Type "mattermost-integration-giphy" in the **repo-name** field, then click Search and then the *Connect* button once Heroku finds your repository

----
