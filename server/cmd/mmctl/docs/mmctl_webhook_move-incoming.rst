.. _mmctl_webhook_move-incoming:

mmctl webhook move-incoming
---------------------------

Move incoming webhook

Synopsis
~~~~~~~~


Transfer ownership of an existing incoming webhook to another user. The new owner must be an active, non-bot user with access to the webhook's channel. Post authorship is unaffected.

::

  mmctl webhook move-incoming [webhookID] [newOwner] [flags]

Examples
~~~~~~~~

::

    webhook move-incoming w16zb5tu3n1zkqo18goqry1je newowner@example.com

Options
~~~~~~~

::

  -h, --help   help for move-incoming

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

