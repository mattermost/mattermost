.. _mmctl_webhook_modify-outgoing:

mmctl webhook modify-outgoing
-----------------------------

Modify outgoing webhook

Synopsis
~~~~~~~~


Modify existing outgoing webhook by changing its title, description, channel, icon, url, content-type, and triggers

::

  mmctl webhook modify-outgoing [flags]

Examples
~~~~~~~~

::

    webhook modify-outgoing [webhookId] --channel [channelId] --display-name [displayName] --description "New webhook description" --icon http://localhost:8000/my-slash-handler-bot-icon.png --url http://localhost:8000/my-webhook-handler --content-type "application/json" --trigger-word test --trigger-when start

Options
~~~~~~~

::

      --channel string             Channel name or ID
      --content-type string        Content-type
      --description string         Outgoing webhook description
      --display-name string        Outgoing webhook display name
  -h, --help                       help for modify-outgoing
      --icon string                Icon URL
      --trigger-when string        When to trigger webhook (exact: for first word matches a trigger word exactly, start: for first word starts with a trigger word)
      --trigger-word stringArray   Word to trigger webhook
      --url stringArray            Callback URL

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

