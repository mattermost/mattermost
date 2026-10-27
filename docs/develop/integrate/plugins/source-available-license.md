---
title: "Source available license"
sidebar_position: 140
---

Some plugins authored by Mattermost are licensed under the [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license). This document outlines how to apply the license in various situations.

## How do I apply the license to an enterprise-only plugin?

An Enterprise-only plugin is a plugin that requires a valid Mattermost Enterprise E20 license. It is not designed to be used with Team Edition or any other Enterprise license.

1. Add the [LICENSE](LICENSE) file to the root of your plugin repository.
2. Add the following section to your README.md directly below the opening paragraph:

    ```md
    ## License
    
    This repository is licensed under the [Mattermost Source Available License](LICENSE) and requires a valid Enterprise E20 license. See [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license) to learn more.
    ```

## How do I apply the license to a mixed-license plugin?

A mixed-license plugin includes components that require a valid Mattermost Enterprise E20 license. Not all features are available when used with Team Edition or any other enterprise license.

1. Organize the Enterprise-only, server-side parts of your plugin in a dedicated folder, typically `server/enterprise`.
2. Add the [LICENSE](LICENSE) file to the `server/enterprise` folder.
3. Symlink that license in the root of your repository as `LICENSE.enterprise`.
4. Add the following section to your README.md directly below the opening paragraph:

    ```md
    ## License
    
    This repository is licensed under the Apache 2.0 License, except for the [server/enterprise](server/enterprise) directory which is licensed under the [Mattermost Source Available License](LICENSE.enterprise). See [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license) to learn more.
    ```
