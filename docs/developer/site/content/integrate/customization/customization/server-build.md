---
title: "Server build (Team Edition)"
heading: "Server build - Mattermost Team Edition"
description: "Find out how to customize and build your own version of the Mattermost open source project."
date: 2018-05-20T11:35:32-04:00
weight: 1
aliases:
  - /extend/customization/server-build/
  - /integrate/other-integrations/customization/server-build/
---

If plugin functionalities don't cover your use cases, you have the freedom to customize and build your own version of the `mattermost-server` project.

Before proceeding with the steps below, make sure you have completed the [mattermost-server setup]({{< ref "contribute/developer-setup" >}}) process.

1. Customize the project according to your requirements.

2. Build binary files for Mattermost server.

    ```shell
    make build
    ```

3. Assemble essential files.

    ```shell
    make package
    ```  

4. Transfer desired `.tar.gz` file to server for deployment.
