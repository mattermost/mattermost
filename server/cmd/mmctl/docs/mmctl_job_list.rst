.. _mmctl_job_list:

mmctl job list
---------------------

List jobs

Synopsis
~~~~~~~~


List jobs

::

  mmctl job list [flags]

Examples
~~~~~~~~

::

    job list

Options
~~~~~~~

::

      --all            Fetch all jobs. --page flag will be ignored if provided
  -h, --help           help for list
      --page int       Page number to fetch for the list of jobs
      --per-page int   Number of jobs to be fetched (default 200)
      --ids strings    Comma separated list of Job Ids, all other flags are ignored
      --status string  Status of the jobs you want to view
      --type string    Type of the jobs you want to view

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
