.. _mmctl_webhook_create-outgoing:

mmctl webhook create-outgoing
-----------------------------

Create outgoing webhook

Synopsis
~~~~~~~~


create outgoing webhook which allows external posting of messages from a specific channel

::

  mmctl webhook create-outgoing [flags]

Examples
~~~~~~~~

::

    webhook create-outgoing --team myteam --user myusername --display-name mywebhook --trigger-word "build" --trigger-word "test" --url http://localhost:8000/my-webhook-handler
  	webhook create-outgoing --team myteam --channel mychannel --user myusername --display-name mywebhook --description "My cool webhook" --trigger-when start --trigger-word build --trigger-word test --icon http://localhost:8000/my-slash-handler-bot-icon.png --url http://localhost:8000/my-webhook-handler --content-type "application/json"

Options
~~~~~~~

::

      --channel string             Channel name or ID
      --content-type string        Content-type
      --description string         Outgoing webhook description
      --display-name string        Outgoing webhook display name (required)
  -h, --help                       help for create-outgoing
      --icon string                Icon URL
      --team string                Team name or ID (required)
      --trigger-when string        When to trigger webhook (exact: for first word matches a trigger word exactly, start: for first word starts with a trigger word) (default "exact")
      --trigger-word stringArray   Word to trigger webhook (required)
      --url stringArray            Callback URL (required)
      --user string                User username, email, or ID (required)

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl webhook <mmctl_webhook.rst>`_ 	 - Management of webhooks

