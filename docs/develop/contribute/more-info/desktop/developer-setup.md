---
title: "Developer setup"
sidebar_position: 1
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

<div id="mac" class="tabcontent" style={{display: 'block'}}>
    
<Note title="Section moved">

This section's content used to be transcluded from `contribute/more-info/desktop/developer-setup/macos.md` via Hugo's `{/* TODO: unconverted Hugo shortcode {{% content %}} (sources/mattermost-developer-documentation/site/content/contribute/more-info/desktop/developer-setup.md) */}` shortcode. In the new IA each include is its own page — see the sidebar.

</Note>

</div>

<div id="ubuntu" class="tabcontent">
    
<Note title="Section moved">

This section's content used to be transcluded from `contribute/more-info/desktop/developer-setup/ubuntu.md` via Hugo's `{/* TODO: unconverted Hugo shortcode {{% content %}} (sources/mattermost-developer-documentation/site/content/contribute/more-info/desktop/developer-setup.md) */}` shortcode. In the new IA each include is its own page — see the sidebar.

</Note>

</div>

<div id="windows" class="tabcontent">
    
<Note title="Section moved">

This section's content used to be transcluded from `contribute/more-info/desktop/developer-setup/windows.md` via Hugo's `{/* TODO: unconverted Hugo shortcode {{% content %}} (sources/mattermost-developer-documentation/site/content/contribute/more-info/desktop/developer-setup.md) */}` shortcode. In the new IA each include is its own page — see the sidebar.

</Note>

</div>

<div id="archlinux" class="tabcontent">
    
<Note title="Section moved">

This section's content used to be transcluded from `contribute/more-info/desktop/developer-setup/arch.md` via Hugo's `{/* TODO: unconverted Hugo shortcode {{% content %}} (sources/mattermost-developer-documentation/site/content/contribute/more-info/desktop/developer-setup.md) */}` shortcode. In the new IA each include is its own page — see the sidebar.

</Note>

</div>

<div id="redhat" class="tabcontent">
    
<Note title="Section moved">

This section's content used to be transcluded from `contribute/more-info/desktop/developer-setup/redhat.md` via Hugo's `{/* TODO: unconverted Hugo shortcode {{% content %}} (sources/mattermost-developer-documentation/site/content/contribute/more-info/desktop/developer-setup.md) */}` shortcode. In the new IA each include is its own page — see the sidebar.

</Note>

</div>

#### Mattermost Server

To develop with the Desktop App, we recommend that you set up a Mattermost server specifically for this purpose. This lets you customize it as needed in cases where there are specific integration requirements needed for testing.

You can find information on setting that up here:
 
[Developer Setup](/developers/contribute/developer-setup)

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
