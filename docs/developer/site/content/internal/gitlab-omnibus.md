---
title: GitLab Omnibus
heading: "GitLab Omnibus Release Process"
description: "Information on updating and building GitLab Omnibus with new versions of Mattermost"
date: 2021-03-12T14:59:29-05:00
weight: 130
---

GitLab's Omnibus package bundles Mattermost Team Edition (TE) as an optional feature that can be enabled during installation. While GitLab maintains most of this integration, we send them new versions of Mattermost and occasionally assist with support on issues that relate to Mattermost.

For every monthly GitLab release, we submit a merge request (MR) to [GitLab's repository](https://gitlab.com/gitlab-org/omnibus-gitlab/) to update the embedded version of Mattermost. GitLab releases in the middle of the month, so we'll generally submit the newest version of Mattermost to them at the start of the month to give time for the review process to happen.

### Setting up GitLab Omnibus for development

We maintain [our own fork of GitLab Omnibus](https://gitlab.com/mattermost/omnibus-gitlab) for use when submitting merge requests upstream. This should be cloned and kept up to date to ensure that we're testing and submitting against the latest code.

These are the steps for checking out GitLab Omnibus and installing its dependencies:

1. Clone our fork.

    ```bash
    git clone https://gitlab.com/mattermost/omnibus-gitlab.git
    ```
       
2. Add the upstream repository as a git remote.

    ```bash
    git remote add upstream https://gitlab.com/gitlab-org/omnibus-gitlab.git
    ```

3. Install Docker. GitLab packages all dependencies for building GitLab Omnibus in a Docker image which will be pulled later.

### Submitting a new version of Mattermost

These are the steps to update GitLab Omnibus with a new version of Mattermost:

1. Ensure our fork's master branch is up to date with upstream.

    ```bash
    git checkout master
    git fetch upstream
    git pull upstream master
    git push
    ```
       
2. Create a branch for the new version of Mattermost.

    ```bash
    git checkout -b mattermost-X.Y
    ```
       
3. Update the version of Mattermost downloaded at build time by modifying `config/software/mattermost.rb`. The `default_version` and `md5` fields need to be set to the match the latest release of Mattermost TE.

4. Add an entry to the table in `doc/gitlab-mattermost/README.md` that maps GitLab versions to the corresponding Mattermost version. This step is not necessary for dot releases of Mattermost.

5. Commit the changes made to `config/software/mattermost.rb` and `doc/gitlab-mattermost/README.md`. The commit message is used to generate a changelog entry, so it must include a second line containing the type of change made. For regular releases, it should be the following:

    ```
    Update Mattermost to X.Y

    Changelog: other
    ```

For security backports, the type should be changed to "security".

You can now test the build and submit an MR upstream. For an example of how the branch should look after that, see [here](https://gitlab.com/gitlab-org/omnibus-gitlab/-/merge_requests/5068).

### Building GitLab Omnibus

As mentioned above, GitLab Omnibus is built in a Docker container containing all of the needed dependencies. To test it, the generated `.deb` package needs to be copied off of the Docker container and installed locally on the test server. Details on how to do that follow.

These steps differ slightly from the more detailed ones available from GitLab ([link](https://gitlab.com/gitlab-org/omnibus-gitlab/-/blob/master/doc/build/build_package.md)) since they were changed to keep the Git repository outside of Docker container, but they still work as of March 4, 2021.

1. Get the current `BUILDER_IMAGE_REVISION` value from `.gitlab-ci.yml`.

2. Run the builder in a Docker container. You may have to run these with `sudo` depending on permissions. This assumes you're using Ubuntu 18.04, but there are other Docker images available for different OSes.

    ```bash
    docker pull registry.gitlab.com/gitlab-org/gitlab-omnibus-builder/ubuntu_18.04:${BUILDER_IMAGE_REVISION}
    docker run -it registry.gitlab.com/gitlab-org/gitlab-omnibus-builder/ubuntu_18.04:${BUILDER_IMAGE_REVISION} bash
    ```

3. Inside the container, clone the repo and change to the folder. Note that we're cloning our fork here.

    ```bash
    git clone https://gitlab.com/mattermost/omnibus-gitlab.git ~/omnibus-gitlab
    cd ~/omnibus-gitlab
    ```

4. Change to the correct branch.

    ```bash
    git checkout mattermost-X.Y
    ```

5. Specify where to grab GitLab dependencies and assets from.

    ```bash
    export ALTERNATIVE_SOURCES=true
    export ASSET_REGISTRY=registry.gitlab.com
    export COMPILE_ASSETS=true
    ```

6. Install Ruby dependencies.

    ```bash
    bundle install
    bundle binstubs --all
    ```

7. Build everything. This can take a couple of hours, so go grab lunch.

    ```bash
    bin/omnibus build gitlab
    ```

8. From the host machine, copy the compiled package out of the Docker container.

    ```bash
    docker cp <container>:/root/omnibus-gitlab/pkg/<package>.deb .
    ```

Note that Docker likes to eat up space on the disk without cleaning up after itself, so you'll want to remove old Docker containers with `docker rm` after building and copying the package to the host machine.

### Installing and configuring GitLab Omnibus

To install GitLab Omnibus with Mattermost, you'll need to configure your DNS with two domain names for the test server: one for GitLab and one for Mattermost. The following steps will use `gitlab.dev.mm` and `mattermost.dev.mm` as those domains.

The package generated above can be installed with `sudo dpkg -i <package>.deb`.

After first installing GitLab Omnibus, the external URLs for GitLab need to be configured, and Mattermost needs to be enabled in the GitLab config. To do that:

1. Open `/etc/gitlab/gitlab.rb` using vi or your preferred text editor.

    ```bash
    sudo vi /etc/gitlab/gitlab.rb
    ```

2. Set the `external_url` to set GitLab's external URL.

    ```ruby
    external_url "http://gitlab.dev.mm"
    ```

3. Find and uncomment the line which sets `mattermost_external_url` and set it to Mattermost's external URL.

    ```ruby
    mattermost_external_url "http://mattermost.dev.mm"
    ```

4. Find and uncomment the line which sets `mattermost['enable']` and set it to `true`.

    ```ruby
    mattermost['enable'] = true
    ```

5. Leave your editor and use `gitlab-ctl` to reconfigure and restart its services.

    ```bash
    sudo gitlab-ctl reconfigure
    ```

After a few minutes, Mattermost and GitLab should be accessible from their respective URLs and GitLab sign-in should be automatically configured in Mattermost. The default admin login on GitLab has the username `root` and the password `5iveL!fe`.

A few more commands for working with GitLab can be found [in our support documentation](https://docs.mattermost.com/process/support.html#other-debugging-information).

### Testing Mattermost in GitLab Omnibus

To test a new version of Mattermost running in GitLab, you'll have to test the three main ways they interact: logging in, creating a Mattermost team for a GitLab group, and adding notifications/slash commands to Mattermost. Using the same URLs as above, the steps for testing are:

1. Test signing into Mattermost, once when not logged into GitLab and then again after having already logged in.

    1. Visit `http://mattermost.dev.mm` in a browser.

    2. Select **Sign in with GitLab**. You should be directed to the GitLab login screen.

    3. Log in as any user. You should be sent back to Mattermost and logged in.

    4. Log out and back in through the same process. You should skip the GitLab login screen since you were still logged into GitLab.

2. Test creating a team in Mattermost for a new GitLab group.

    1. Open `http://gitlab.dev.mm` in another window.

    2. Select the plus icon in the header bar and select **New group**.

    3. Enter a name for the group and check **Create a Mattermost team for this group**.

    4. Go back to Mattermost. You should have been added to a new team matching the name of the group.

3. Test adding the GitLab slash command.

    1. Go to GitLab.

    2. Select the plus icon in the header bar and select **New project**.

    3. Select **Create blank project**. Enter a name and choose **Create project**.

    4. From the sidebar on the left, go to **Settings > Integrations**.

    5. Scroll down and select **Mattermost slash commands**.

    6. Select **Add to Mattermost**.

    7. Select the team you created above from the drop-down, then choose **Install**.

    8. Go back to Mattermost and use `/<project>`.

    9. When prompted, select **Connect your GitLab Account**, then choose **Authorize**.

    10. You should now be able to use the slash command to do things like creating and viewing issues.

4. Test adding GitLab notifications.

    1. In Mattermost, go to **Integrations > Incoming Webhooks** and add an incoming webhook.
    
    2. Copy the URL of the webhook and return to Mattermost.

    3. Go to GitLab. From the sidebar on the left, go to **Settings > Integrations**.

    4. Scroll down and select **Mattermost notifications**.

    5. Paste the previously copied webhook URL into the **Webhook** field, then select **Save changes**.

    6. Create an issue either from the GitLab UI or by using the previously configured slash command. A notification should be posted by the webhook in the channel you created.

### Useful Files and Commands

When working on GitLab Omnibus, the following files might be useful:

- `config/software/mattermost.rb` - The script for downloading Mattermost during GitLab Omnibus's build and extracting the required files for it.
- `doc/gitlab-mattermost/README.md` - GitLab's documentation for using the embedded version of Mattermost.
- `files/gitlab-cookbooks/mattermost/libraries/mattermost_helper.rb` - The list of environment variables that GitLab Omnibus passes to Mattermost.
- `files/gitlab-cookbooks/mattermost/recipes/enable.rb` - The script to set up the required files and folders for Mattermost after installation.

After installing GitLab Omnibus, the following files and folders might be useful:
- `/etc/gitlab/gitlab.rb` - The configuration files for GitLab Omnibus itself. `gitlab reconfigure [<service>]` must be called to apply any changes made.
- `/var/opt/gitlab/mattermost/config.json` - The location of Mattermost's `config.json`.
- `/var/log/gitlab/mattermost/logs/current` - The logs for Mattermost.
- `/var/opt/gitlab/mattermost/data` - The data directory for Mattermost.
- `/opt/gitlab/embedded/service/mattermost` - The static files used by Mattermost (web app code, i18n strings, email templates, etc).
