---
title: "Developer setup"
heading: "Set up your development environment"
description: "Find out how to set up your development environment for building, running, and testing the Mattermost desktop app."
date: 2020-02-01T19:50:32-04:00
weight: 1
aliases:
  - /contribute/desktop/developer-setup
---

Set up your development environment for building, running, and testing the Mattermost Desktop App.

## Dependencies

<div class="tab">
    <button class="tablinks active" onclick="openTab(event, 'mac')">macOS</button>
    <button class="tablinks" onclick="openTab(event, 'windows')">Windows</button>
    <button class="tablinks" onclick="openTab(event, 'ubuntu')">Ubuntu</button>
    <button class="tablinks" onclick="openTab(event, 'archlinux')">Arch Linux</button>
    <button class="tablinks" onclick="openTab(event, 'redhat')">Fedora/RedHat/CentOS</button>
</div>

<div id="mac" class="tabcontent" style="display: block;">
    {{% content "contribute/more-info/desktop/developer-setup/macos.md" %}}
</div>

<div id="ubuntu" class="tabcontent">
    {{% content "contribute/more-info/desktop/developer-setup/ubuntu.md" %}}
</div>

<div id="windows" class="tabcontent">
    {{% content "contribute/more-info/desktop/developer-setup/windows.md" %}}
</div>

<div id="archlinux" class="tabcontent">
    {{% content "contribute/more-info/desktop/developer-setup/arch.md" %}}
</div>

<div id="redhat" class="tabcontent">
    {{% content "contribute/more-info/desktop/developer-setup/redhat.md" %}}
</div>

#### Mattermost Server

To develop with the Desktop App, we recommend that you set up a Mattermost server specifically for this purpose. This lets you customize it as needed in cases where there are specific integration requirements needed for testing.

You can find information on setting that up here:
 
[Developer Setup]({{< ref "/contribute/developer-setup" >}})

Alternatively, for some changes you may be able to test using an existing Mattermost instance, or one that has been deployed on platforms like Docker, Linux, Kubernetes, Heroku, or others. Please refer to the [Mattermost Deployment Guide](https://docs.mattermost.com/guides/deployment.html) for more info.

## Repo setup

1. Fork GitHub Repository: https://github.com/mattermost/desktop
2. Clone from your repo: 

    ```sh
    git clone https://github.com/<YOUR_GITHUB_USERNAME>/desktop.git
    ```

3. Open the desktop directory

    ```sh
    cd desktop
    ```

4. Install Node Modules

    ```sh
    npm i
    ```

5. Run the application

    ```sh
    npm run watch
    ```
