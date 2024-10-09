.. _mmctl_post_delete:

mmctl post delete
-----------------

Mark posts as deleted or permanently delete posts with the --permanent flag

Synopsis
~~~~~~~~


This command will mark the post as deleted and remove it from the user's clients, but it does not permanently delete the post from the database. Please use the --permanent flag to permanently delete a post and its attachments from your database.

::

  mmctl post delete [posts] [flags]

Examples
~~~~~~~~

::

    # Mark Post as deleted
    $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw

    # Permanently delete a post and it's file contents from the database and filestore
    $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw --permanent

    # Permanently delete multiple posts and their file contents from the database and filestore
    $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw 7jgcjt7tyjyyu83qz81wo84w6o --permanent

Options
~~~~~~~

::

      --confirm     Confirm you really want to delete the post and a DB backup has been performed
  -h, --help        help for delete
      --permanent   Permanently delete the post and its contents from the database

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

