---
title: "Embed Mattermost"
heading: "Use Mattermost in other applications"
description: "This guide discusses how to embed Mattermost into other applications in different ways."
weight: 80
aliases:
  - /integrate/other-integrations/embed/
  - /integrate/admin-guide/admin-embedding/
---

## Launch Mattermost from a button selection

The most common way of integrating Mattermost into another application is via a link or a button that brings up Mattermost in a new browser window or tab, with a link to a specific Mattermost channel to begin discussion.

Optionally, single-sign-on can be added to make the experience seamless.

### Mattermost launch button example in HTML 

Save the below HTML code in a file called `mattermost-button-example.html` then open the file in a browser as an example.

```html
<script>
    var myWindow = null;

    function openMMWindow() {
        myWindow = window.open("https://community.mattermost.com/core/channels/developer", "Mattermost", "top=0,left=0,width=400,height=600,status=no,toolbar=no,location=no,menubar=no,titlebar=no");
    }

    function closeMMWindow() {
        if (myWindow) {
            myWindow.close();
        }
    }
</script>

<html>
    <br/>
    <br/>
    <button onclick="openMMWindow()">Open Developer Channel</button>
    <br/>
    <br/>
    <button onclick="closeMMWindow()">Close Developer Channel</button>
    <br/>
    <br/>
</html>
```

## Embed Mattermost in web apps using an &lt;iframe&gt;

Any web application embedded into another using an {{< newtabref href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe" title="<iframe>" >}} is at risk of security exploits, since the outer application intercepts all user input into the embedded application, an exploit known as {{< newtabref href="https://en.wikipedia.org/wiki/Clickjacking" title="Click-Jacking" >}}. By default, Mattermost disables embedding. If you choose to embed Mattermost we highly recommend it is done only on a private network that you control.

See {{< newtabref href="https://forum.mattermost.com/t/recipe-embedding-mattermost-in-web-applications-using-an-iframe-unsupported-recipe/10233" title="this recipe" >}} for details.

## Embed Mattermost in mobile apps

The open source mobile applications can serve as a guide or starter code to embed Mattermost in mobile applications. The Mattermost Javascript Driver is used to connect with the Mattermost server and product the interactivity for these applications.

The mobile applications also provide full source code for push notifications.

### Mobile apps offering Mattermost as a web view 

- https://github.com/mattermost/ios

### Mobile apps offering Mattermost with React Native components 

- https://github.com/mattermost/mattermost-mobile
