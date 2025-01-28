.. _mmctl_post_create:

mmctl post create
-----------------

Create a post

Synopsis
~~~~~~~~


This command cammand can be use to create a post on a channel and to send a direct message to a user.

::

  mmctl post create [flags]

Examples
~~~~~~~~

::

   # Example of post on a channel
  	post create myteam:mychannel "some text for the post"

  	# Example of a direct message
  	post create @some-user "some direct message"

Options
~~~~~~~

::

  -h, --help              help for create
  -m, --message string    Message for the post
  -r, --reply-to string   Post id to reply to

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

* `mmctl post <mmctl_post.rst>`_ 	 - Management of posts

