# Creating Teams
___
New teams can be created if the System Administrator has *Enable Team Creation* set to true from the system console.

## Methods to Create a Team
Teams can be created from the main menu, system home page or team sign in page.

#### Main Menu
Click the **Three-Dot** menu in Mattermost, then select **Create a New Team**. If this option is not visible in the menu, then the System Administrator has *Enable Team Creation* set to false.


#### System Home Page
Navigate to the web address of your system, `https://domain.com/`. Enter a valid email address and click **Create Team** to be guided through the rest of the set up steps. If this option is not visible on the web page, then the System Administrator has *Enable Team Creation* set to false. It is not necessary to have an existing account on the system in order to create a team from the system home page.

#### Team Sign In Page
Navigate to the web address of your team, `https://domain.com/teamurl/`. If you are logged in, the web address will open Mattermost and you can create a new team from the main menu. If you are logged out, the web address will direct you to the sign in page where you can click **Create a New Team**. If this option is not visible on the web page, then the System Administrator has *Enable Team Creation* set to false. It is not necessary to have an existing account on the system in order to create a team from the sign in page.

## Team Name and URL Selection
There are a few details and restrictions to consider when selecting a team name and team URL.

#### Team Name
This is the display name of your team that appears in menus and headings.

- It can contain any letters, numbers or symbols.
- It is case sensitive.
- It must be 4 - 15 characters in length.

#### Team URL
The team URL is part of the web address that navigates to your team on the system domain, `https://domain.com/teamurl/`. 

- It may contain only lowercase letters, numbers and dashes.
- It must start with a letter and cannot end in a dash.
- It must be 4 - 15 characters in length.

If the system administrator has *Restrict Team Names* set to true, the team URL cannot start with the following restricted words: www, web, admin, support, notify, test, demo, mail, team, channel, internal, localhost, dockerhost, stag, post, cluster, api, oauth.

## User Roles on Multiple Teams
Each user is distinct and owned by a team. A team creator is automatically granted Team Administrator privileges for that team, even if they are a System Administrator on another team. A System Administrator with accounts on multiple teams must grant all their accounts *System Admin* privileges from the system console. To do this, go to the **Main Menu > System Console**, then click **Users** under the *Teams* heading for the team you want to manage.
