# Testing Text Processing  
The text processing tests located in the [doc/developer/tests folder](https://github.com/mattermost/platform/tree/master/doc/developer/tests) are designed for use with the `/loadtest url` command. This command posts the raw contents of a specified .md file in the doc/developer/test folder into Mattermost.

## Turning on /loadtest  
Access the **System Console** from the Main Menu. Under *Service Settings* make sure that *Enable Testing* is set to `true`, then click **Save**. You may also change this setting from `config.json` by setting `”EnableTesting”: true`. Changing this setting requires a server restart to take effect.

## Running the Tests  
In the text input box in Mattermost, type: `/loadtest url [file-name-in-testing-folder].md`. Some examples:

`/loadtest url test-emoticons.md`  
`/loadtest url test-links.md`

#### Notes:    
1. If a test has prerequisites, make sure your Mattermost setup meets the requirements described at the top of the test file.
2. Some tests are over 4000 characters in length and will render across multiple posts.

## Manual Testing  
It is possible to manually test specific sections of any test, instead of using the /loadtest command. Do this by clicking **Raw** in the header for the file when it’s open in GitHub, then copy and paste any section into Mattermost to post it. Manual testing only supports sections of 4000 characters or less per post.
