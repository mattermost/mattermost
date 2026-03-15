---
title: "Web app"
heading: "Customize the Mattermost web app"
description: "Learn about customizations to the Mattermost Web App that can be performed when you need to customized branding, functionality or security."
date: 2018-05-20T11:35:32-04:00
weight: 1
aliases:
  - /extend/customization/webapp/
  - /integrate/other-integrations/customization/webapp/
---

Customizations to the Mattermost Web App can be performed in cases where you need to customize branding, alter localization strings, or fulfill security requirements that are not immediately offered out-of-the-box.  
  
## Customization steps 
With that in mind, customizing and deploying your Mattermost Web App can be done in a few steps:  

1. Fork the {{< newtabref href="https://github.com/mattermost/mattermost" title="mattermost" >}} repository and then clone your fork in your local environment.
   
    ```shell
    git clone https://github.com/<yourgithubusername>/mattermost
    ```

2. Create a separate branch for your customized version, as it's not recommended to perform them in the `master` branch (more details about that in the next section regarding rebasing).
   
    ```shell
    git checkout -b custom_branch
    ```
   
3. Perform customization tasks by replacing image assets, changing strings, altering the UI, and whatever else may be necessary. Be mindful not to violate any of the {{< newtabref href="https://mattermost.com/trademark-standards-of-use/" title="guidelines on trademark use" >}} during this process.

4. Once customization has been completed, build the files that will be used in your deployment and generate `mattermost-webapp.tar.gz` containing them.

    ```shell
    make dist
    ```

5. In a Mattermost deployment, rename `client` (assuming Mattermost was deployed in the `$HOME` directory).
   
    ```shell
    cd ~/mattermost
    mv client client-original
    ```

6. Transfer compressed `dist` files inside Mattermost's `client` directory, and decompress it.

    ```shell
    tar -xvf mattermost-webapp.tar.gz
    ```

7. Copy the `products` subdirectory from the original deployment into the customized one.

    ```shell
    cp -R client-original/products client/products
    ```

## Rebasing to latest version
Challenges arise when creating a separate custom branch from an active open-source project like `mattermost`. As the project gets new commits and pull requests on a daily basis, your custom webapp can quickly become outdated.

To deal with that, you'll need to leverage Git's {{< newtabref href="https://git-scm.com/docs/git-rebase#_interactive_mode" title="interactive rebasing functionality" >}} in the following way:

1. Add an upstream with the original `mattermost` repository.

    ```shell
    git remote add upstream https://github.com/mattermost/mattermost.git
    ```

2. Update `master` branch to latest upstream commit.

    ```shell
    git checkout master
    git pull upstream master
    ```

3. Perform interactive rebase.

    ```shell
    git checkout custom_branch  
    git rebase -i master
    ```

    Use `git rebase --continue` after resolving any conflicts that arise during rebase process

4. Push new version back to remote (Note: Rebasing requires that you override previous remote version with a `force` push. Be sure you've tested that your rebase was successful before completing this last command).
   
    ```shell
    git push -f origin custom_branch  
    ```
