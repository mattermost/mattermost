.. _mmctl_sampledata:

mmctl sampledata
----------------

Generate sample data

Synopsis
~~~~~~~~


Generate a sample data file and store it locally, or directly import it to the remote server

::

  mmctl sampledata [flags]

Examples
~~~~~~~~

::

    # you can create a sampledata file and store it locally
    $ mmctl sampledata --bulk sampledata-file.jsonl

    # or you can simply print it to the stdout
    $ mmctl sampledata --bulk -

    # the amount of entities to create can be customized
    $ mmctl sampledata -t 7 -u 20 -g 4

    # the sampledata file can be directly imported in the remote server by not specifying a --bulk flag
    $ mmctl sampledata

    # and the sample users can be created with profile pictures
    $ mmctl sampledata --profile-images ./images/profiles

Options
~~~~~~~

::

  -b, --bulk string                    Optional. Path to write a JSONL bulk file instead of uploading into the remote server.
      --channel-memberships int        The number of sample channel memberships per user in a team. (default 5)
      --channels-per-team int          The number of sample channels per team. (default 10)
      --deactivated-users int          The number of deactivated users.
      --direct-channels int            The number of sample direct message channels. (default 30)
      --group-channels int             The number of sample group message channels. (default 15)
  -g, --guests int                     The number of sample guests. (default 1)
  -h, --help                           help for sampledata
      --posts-per-channel int          The number of sample post per channel. (default 100)
      --posts-per-direct-channel int   The number of sample posts per direct message channel. (default 15)
      --posts-per-group-channel int    The number of sample posts per group message channel. (default 30)
      --profile-images string          Optional. Path to folder with images to randomly pick as user profile image.
  -s, --seed int                       Seed used for generating the random data (Different seeds generate different data). (default 1)
      --team-memberships int           The number of sample team memberships per user. (default 2)
  -t, --teams int                      The number of sample teams. (default 2)
  -u, --users int                      The number of sample users. (default 15)

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

* `mmctl <mmctl.rst>`_ 	 - Remote client for the Open Source, self-hosted Slack-alternative

