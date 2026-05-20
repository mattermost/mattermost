.. _mmctl_job_list:

mmctl job list
--------------

List the latest jobs

Synopsis
~~~~~~~~


List the latest jobs

::

  mmctl job list [flags]

Examples
~~~~~~~~

::

    job list
  	job list --ids jobID1,jobID2
  	job list --type ldap_sync --status success
  	job list --type ldap_sync --status success --page 0 --per-page 10

Options
~~~~~~~

::

      --all             Fetch all import jobs. --page flag will be ignored if provided
  -h, --help            help for list
      --ids strings     Comma-separated list of job IDs to which the operation will be applied. All other flags are ignored
      --page int        Page number to fetch for the list of import jobs
      --per-page int    Number of import jobs to be fetched (default 5)
      --status string   Filter by job status
      --type string     Filter by job type

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

* `mmctl job <mmctl_job.rst>`_ 	 - Management of jobs

