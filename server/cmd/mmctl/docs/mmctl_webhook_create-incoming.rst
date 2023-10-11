.. _mmctl_webhook_create-incoming:

mmctl webhook create-incoming
-----------------------------

Create incoming webhook

Synopsis
~~~~~~~~


create incoming webhook which allows external posting of messages to specific channel

::

  mmctl webhook create-incoming [flags]

Examples
~~~~~~~~

::

    webhook create-incoming --channel [channelID] --user [userID] --display-name [displayName] --description [webhookDescription] --lock-to-channel --icon [iconURL]

Options
~~~~~~~

::

      --channel string        Channel ID (required)
      --description string    Incoming webhook description
      --display-name string   Incoming webhook display name
  -h, --help                  help for create-incoming
      --icon string           Icon URL
      --lock-to-channel       Lock to channel
      --user string           User ID (required)

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

