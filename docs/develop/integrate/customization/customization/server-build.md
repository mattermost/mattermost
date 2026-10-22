---
title: "Server build (Team Edition)"
sidebar_position: 1
---

If plugin functionalities don't cover your use cases, you have the freedom to customize and build your own version of the `mattermost-server` project.

Before proceeding with the steps below, make sure you have completed the [mattermost-server setup](/developers/contribute/developer-setup) process.

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
