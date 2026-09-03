# connstr-peek

Connection strings get pasted into Slack threads, bug reports, and log lines constantly, and
they usually have a password sitting right in the middle of them. This is a small command-line
tool that parses a connection string and prints back a plain-text breakdown of what's actually
in it — host, port, database, ssl mode — without ever printing the password itself.

It also helps with strings that are just hard to read at a glance: multi-host replica-set style
URLs, ODBC/ADO.NET key=value strings, JDBC URLs. Instead of squinting at commas and semicolons,
you get a short report.

## usage

    npx tsc
    node dist/index.js "postgres://appuser:hunter2@db1.internal:5432,db2.internal:5432/orders?sslmode=require"

    format:     url (postgres)
    hosts:      2 found (failover / replica set)
                  - db1.internal:5432
                  - db2.internal:5432
    database:   orders
    user:       appuser
    password:   present (redacted)
    ssl:        require

    redacted:   postgres://appuser:***@db1.internal:5432,db2.internal:5432/orders?sslmode=require

It also reads from stdin, which is handy for piping something out of a log file without it
lingering in your shell history:

    echo "Server=sql01.internal;Port=1433;Database=orders;User Id=appuser;Password=hunter2;Encrypt=true;" | node dist/index.js

Pass `--json` if you want the same breakdown as structured output instead of the text report,
for feeding into another script:

    node dist/index.js --json "postgres://appuser:hunter2@db.internal:5432/orders?sslmode=require"

    {
      "format": "url",
      "scheme": "postgres",
      "hosts": [{ "host": "db.internal", "port": "5432" }],
      "database": "orders",
      "user": "appuser",
      "hasPassword": true,
      "sslMode": "require",
      "params": {},
      "redacted": "postgres://appuser:***@db.internal:5432/orders?sslmode=require"
    }

## supported formats

- URL style: `postgres://`, `mysql://`, `mongodb://`, `redis://`, `amqp://`, and anything else
  shaped like `scheme://user:pass@host:port/db?params`, including comma-separated multi-host
  lists for replica sets.
- JDBC style: `jdbc:postgresql://host:port/db`.
- ODBC/ADO.NET key=value style: `Key=Value;Key2=Value2;...`.

## running tests

    npm test

Tests use Node's built-in test runner (`node:test`), so there's nothing extra to install.

## what it doesn't do

It doesn't validate that a string is a *correct* connection string for a given driver, and it
doesn't try to connect anywhere. It only tells you what's in the string.

## license

MIT
