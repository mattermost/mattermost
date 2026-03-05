---
title: "Server files"
heading: "Mattermost Server files"
description: "In Mattermost, you have the freedom to alter how content is displayed by being able to change the contents of localized files and email templates."
date: 2018-05-20T11:35:32-04:00
weight: 1
aliases:
  - /extend/customization/server-files/
  - /integrate/other-integrations/server-files/
---

In both Mattermost Team and Enterprise editions, you have the freedom to alter how content is displayed by being able to change the contents of localized files and email templates.

Before proceeding with the steps below, make sure you have completed the [mattermost-server]({{< ref "/contribute/developer-setup" >}}) and [mattermost-webapp]({{< ref "/contribute/developer-setup" >}}) setup process.

## i18n files
The `i18n` files define many of the contents seen in email notifications and responses from the server.

1. Edit contents of files in the `mattermost/server/i18n` directory according to your requirements.

2. Once you're ready, create a tarball or zip the files __within__ the `i18n` directory.

    ```shell
    cd i18n
    tar -cvf i18n.tar *
    ```

3. Before replacing the files, stop your Mattermost instance if it's currently running.

    ```shell
    sudo service mattermost stop
    ```

4. In your Mattermost deployment, back up and remove the files inside `i18n` that will no longer be in use.

    ```shell
    cd ~/mattermost/i18n
    tar -cvf i18n-yyyy-MM-dd.tar *
    rm -f *.json
    ```

5. Transfer your custom `i18n.tar` file to the deployment server and extract it in the `i18n` directory.

    ```shell
    mv i18n.tar mattermost/i18n
    cd ~/mattermost/i18n
    tar -xvf i18n.tar
    ```

6. Restart your Mattermost instance.

    ```shell
    sudo service mattermost start
    ```

## Email templates
Similarly to the i18n files, email templates can be edited and applied onto a running Mattermost instance in the following manner:

1. Edit the `html` files inside of the `templates` directory. In this example we'll assume the `post_body_full.html` file has been customized.

2. Stop your Mattermost instance if it's currently running.

    ```shell
    sudo service mattermost stop
    ```

3. (optional) Rename the template file to be replaced to keep it as a backup.

    ```shell
    cd ~/mattermost/templates
    mv post_body_full.html post_body_full_yyyy_MM_dd.html
    ```

4. Transfer your custom `post_body_full.html` file to the deployment server and place it inside `templates`.
   
    ```shell
    mv ./post_body_full.html ~/mattermost/templates/
    ```

5. Restart your Mattermost instance.
   
    ```shell
    sudo service mattermost start
    ```
