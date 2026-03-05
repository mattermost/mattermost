---
title: "Avoiding Common Internationalization Mistakes"
slug: common-i18n-mistakes
date: 2020-12-04T12:00:00-05:00
categories:
    - "i18n"
author: Harrison Healey
github: hmhealey
community: harrison
canonicalUrl: https://mattermost.com/blog/avoiding-common-internationalization-mistakes/
---

Languages are complicated, and every language is complicated in different ways that can be hard to understand without learning every single one of them. Some languages form words from multiple characters while others have symbols that represent entire concepts. Some feature words without pluralization or gender and rely on context for that while others have two or even more genders for words. Some are very phonetic while others pronounce words seemingly at random (*cough* English, though *cough*).

Thanks to a tremendous contribution long ago from then-community member Elias Nahum, we have full support for translation throughout Mattermost, and thanks to our community of translators, Mattermost is used in a variety of different languages.

Because we support so many languages, we have to be aware of how to keep our applications properly translatable. There are many easy mistakes you can make when writing an application in one language that can make it difficult to translate into others. We use {{< newtabref href="https://formatjs.io/docs/react-intl/" title="React Intl" >}} in our client-side applications and {{< newtabref href="https://github.com/nicksnyder/go-i18n" title="go-i18n" >}} on the server which both offer a range of features to help with this, but we can still cause problems if we're not careful when using translated text. Here are a few examples of common problems that we've run into and how to solve them.

## Mistake 1: Not translating something

This one is definitely the easiest to avoid, but it can still catch people who aren't used to writing applications outside their native language.

For example, suppose someone is adding a new button to the web app using React. If they forget to make it to use React Intl, they may write something like this:

```typescript
function MyButton() {
    return <button>{'Click me!'}</button>;
}
```

That's fine if only English-speaking people use your application, but that doesn't work for us. Instead, we can use React Intl's `FormattedMessage` component to do the translation for us.

```typescript
import {FormattedMessage} from 'react-intl';

function MyButton() {
    return (
        <button>
            <FormattedMessage
                id='my_button.label'
                defaultMessage='Click me!'
            />
        </button>
    );
}
```

The code ends up being a bit longer, but that's more than worth it for making the app translatable.

## Mistake 2: Hard coding translations

This mistake is less common since it requires mixing translated and non-translated text, but it comes from a real-world example in Mattermost.

When you reply to an older message in Mattermost, we display "Commented on Billy's message:" to tell everyone that you're responding to Billy. For a while after we had translation support added, the code for that looked like this:

```typescript
let username = '@' + rootPost.username;
if (!username.endsWith('s')) {
    username += '\'s';
}

return (
    <FormattedMessage
        id='post.commentedOn'
        defaultMessage='Commented on {username} message:'
        values={{username}}
    />
)
```

Here, we're using React Intl to add Billy's name into the text as a value, but we're making a mistake by trying to make the username into a possessive adjective ourselves. By manually adding the "'s", we're applying English grammar regardless of the user's language setting, so this label won't make sense in other languages.

Instead, the "'s" should be part of the translation string. That required changing our grammar rules slightly since we previously avoided adding "'s" to the end of names that ended in the letter "s", but the new way is still correct according to other popular grammar guidelines. Isn't English great?

```typescript
return (
    <FormattedMessage
        id='post.commentedOn'
        defaultMessage="Commented on @{username}'s message:"
        values={{username: rootPost.username}}
    />
);
```

## Mistake 3: Incorrect pluralization

Another common mistake is to forget that pluralization exists when counting something, so you end up with text that looks like "1 posts deleted". You can attempt to avoid that by adding (s) to the end of a word, but that doesn't look very nice, and other languages may not have anything comparable that they can do to replicate that. Thankfully, our translation libraries can help us out here.

Say you're adding a feature that sends out an email to a number of people, and you want it to report back on its progress in both the UI and in the server's logs. You might write something like this:

```typescript
return (
    <FormattedMessage
        id='email_sender.remaining'
        defaultMessage='{remaining, number} email(s) remaining.'
        values={{remaining}}
    />
);
```

```go
/*
    The translation file contains:
    {
        "id": "app.email_sender.remaining",
        "translation": "{{.Remaining}} email(s) remaining"
    }
*/

func logEmailsRemaining(remaining int) {
    log.Print(translateFunc("app.email_sender.remaining", map[string]interface{}{
        "Remaining": remaining,
    }))
}
```

Note that the React example uses a feature of React Intl to specify that `remaining` is a number. Without it, "0 emails remaining" wouldn't be shown properly because it's a falsy value in JavaScript.

That is an example of how we can tell React Intl to behave slightly differently though. If we use the `plural` modifier, we can specify different text based on the value of `remaining`. go-i18n has a similar feature, but it takes two different versions of the translated string instead of constructing one that's more complicated.

```typescript
return (
    <FormattedMessage
        id='email_sender.remaining'
        defaultMessage='{remaining, number} {remaining, plural, one {email} other {emails}} remaining.'
        values={{remaining}}
    />
);
```

```go
/*
    The translation file contains:
    {
        "id": "app.email_sender.remaining",
        "translation": {
            "one": "{{.Remaining}} email remaining",
            "other": "{{.Remaining}} emails remaining"
        }
    }
*/

func logEmailsRemaining(remaining int) {
    log.Print(translateFunc("app.email_sender.remaining", remaining, map[string]interface{}{
        "Remaining": remaining,
    }))
}
```

In both of these, we're defining different translation strings based on the value of remaining. As mentioned before, React Intl lets you change how a single part of the string is translated as opposed to go-i18n which swaps out the entire string, but the result is the same either way.

In addition to just changing "email" to "emails", this also lets translators handle pluralization differently for their own language. For example, some languages don't pluralize their word for email while others, such as Spanish, may also change pluralize "remaining" as well. Here's how the web app's translation file would look for the React example above:

```json
{
    "email_sender.remaining": "{remaining, number} {remaining, plural, one {correo pendiente} other {correos pendientes}}."
}
```

Since "pendiente" for "remaining" changes based on the number of remaining emails, it has also been moved into the curly brackets.

## Mistake 4: Concatenating translated strings

This last mistake is one we encounter more often, and it's one that's a bit harder to solve because it requires using some more complicated techniques that even we haven't adopted everywhere yet. It also takes a bit longer to describe the problem we can encounter here.

Suppose you have a popup which contains some helpful information as well as a link to further documentation. It probably ends with the sentence "{{< newtabref href="https://mattermost.com" title="Click here" >}} for more information." where "Click here" is a link. You might just write this as follows:

```typescript
return (
    <>
        <a
            href='https://mattermost.com'
            rel='noreferrer'
            target='_blank'
        >
            <FormattedMessage
                id='popup.clickHere'
                defaultMessage='Click here'
            />
        </a>
        {' '}
        <FormattedMessage
            id='popup.forMoreInformation'
            defaultMessage='for more information.'
        />
    </>
);
```

This works in English, but it may not work in other languages. For example, some languages may invert the sentence structure to be more like "For more information, click here" while others, like Chinese, may not include a space between words.

Generally, we shouldn't be concatenating translated strings since it's a sign that the sentence structure may not work for everyone. Instead, we should move as much as we can into the translation string so that translators can construct the sentence as necessary. There's a few ways to do this that we've been iterating and improving on, so I'm going to present them separately and talk about why the final method is likely the best.

### Solution 1: React elements as values

Similar to the example on pluralization, we can actually pass translated text into another block of translated text as a value to construct the sentence.

```typescript
return (
    <FormattedMessage
        id='popup.moreInformation'
        defaultMessage='{link} for more information.'
        values={{
            link: (
                <a
                    href='https://mattermost.com'
                    rel='noreferrer'
                    target='_blank'
                >
                    <FormattedMessage
                        id='popup.moreInformation.link'
                        defaultMessage='Click here'
                    />
                </a>
            ),
        }}
    />
);
```

You'll often see this used in older Mattermost code when we're trying to format part of a string. It allows us to add more complex formatting within translated text without making it impossible to translate.

It does, however, make it harder for translators to understand the meaning of the text. They need to spend time reconstructing the entire sentence which may be difficult. It also makes the code more complicated to read for the same reason.

### Solution 2: FormattedHTMLMessage

`FormattedHTMLMessage` was another way to solve this problem, but it was removed in more recent versions. It's a component provided by React Intl, similar to `FormattedMessage`, but allows us to include HTML in the translation string instead of nesting translated text. Since it's been removed, it can't be used any more, but it demonstrates another problem we ran into in the past.

```typescript
// import {FormattedHTMLMessage} from 'react-intl';

return (
    <FormattedHTMLMessage
        id='popup.moreInformation'
        defaultMessage='<a href="https://mattermost.com" rel="noreferrer" target="_blank">Click here</a> for more information.'
    />
);
```

As with the previous solution, this allows translators to reconstruct the sentence however they need, but it comes with a few serious downsides such as:
1. Translators needed to understand HTML, including more complicated things like the extra parameters on the `a` tag.
2. It added the chance that an incorrect translation could break part of the application by accidentally including malformed HTML within a string.
3. It also had potential performance impacts since we were going outside of React's DOM manipulation optimizations by using raw HTML.
4. We lost the ability to wrap parts of the string in React elements which can have more functionality, such as encapsulating the additional parameters passed into `a` tag.
5. Since it used HTML, `FormattedHTMLMessage` wasn't available in React Native for use in our mobile apps.

But despite these issues, it helped point us in the right direction since it led to a custom component that's much nicer to work with.

### Solution 3: FormattedMarkdownMessage

`FormattedMarkdownMessage` was added by another one of our team members, Martin Kraft, as a safer and slightly simpler alternative to `FormattedHTMLMessage`. Instead of the translator needing to understand the complexities of HTML, they instead use Markdown which is generally simpler.

```jsx
// import {FormattedMarkdownMessage} from 'components/formatted_markdown_message';

return (
    <FormattedMarkdownMessage
        id='popup.moreInformation'
        defaultMessage='[Click here](!https://mattermost.com) for more information.'
    />
);
```

Much better! It does require some additional knowledge that adding an exclamation mark to the link tells `FormattedMarkdownMessage` to open it in a new window, but there's a lot less learning required compared to HTML. That said, this formatting is even more limited than the previous options, and `FormattedMarkdownMessage` doesn't fix the potential for performance problems because it still has to parse Markdown.

This technique is used frequently throughout our apps, and until recently, I would've considered it to be the best way of doing this, but now that we've upgraded React Intl, we have access to a new feature which I think is even nicer.

### Solution 4: Rich text formatting in React Intl

React Intl now supports custom HTML-like formatting within the translated text. To do this, you construct an HTML-like string such as `<link>Click here</link> for more information.` using any number of custom tags, and then you define what those tags mean without the translator having to worry about the defails.

In our case, we still want the link to open in a new tab, but now we can do that without the translator having to know anything about that.

```typescript
return (
    <FormattedMessage
        id='popup.moreInformation'
        defaultMessage='<link>Click here</link> for more information.'
        values={{
            link: (msg: React.ReactNode) => (
                <a
                    href='https://mattermost.com'
                    referrer='noreferrer'
                    target='_blank'
                >
                    {msg}
                </a>
            ),
        }}
    />
);
```

The code itself looks similar to when we used nested translation strings, but there's only a single HTML-like string to translate and a function is passed in as the `link` value instead of a React node. That function defines how we want the link rendered, and it lets us include whatever potentially complex formatting we need without complicating the lives of the translators. It also lets us keep the existing translated string even if we need to change how the link works.

In addition to being able to render HTML in this way, we can even use it to format translated text with custom React components too. For example, if we had an `ExternalLink` component that encapsulated the extra parameters passed to the `a` tag, we could simplify this code even further.

```typescript
return (
    <FormattedMessage
        id='popup.moreInformation'
        defaultMessage='<link>Click here</link> for more information.'
        values={{
            link: (msg: React.ReactNode) => <ExternalLink href='https://mattermost.com'>{msg}</ExternalLink>,
        }}
    />
);
```

## Closing Thoughts

Hopefully, we can do our best to make Mattermost easily translatable and available in many different languages, even as Mattermost grows and the amount of text that needs to be translated increases. By avoiding these mistakes and using some of these techniques, we can help to reduce the workload of our translators and make their jobs easier.

Special thanks again to everyone who helps translate Mattermost and who make it usable by so many more people around the world. We tremendously appreciate your efforts and all the work you put in to make sure the translations stay complete and up to date.

If you're interested in helping out with localization or if you have any suggestions for how to improve our process, feel free to join us in the `~localization` channel on the Mattermost community server at https://community.mattermost.com.
