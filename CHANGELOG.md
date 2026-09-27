# Changelog

## 0.1.0 - unreleased

First pass at the tool. Not published yet.

- Parse URL-style connection strings (`scheme://user:pass@host:port/db?params`),
  including comma-separated multi-host lists and IPv6 literals.
- Parse `jdbc:` prefixed URLs by stripping the prefix, parsing normally, and
  reattaching it to the reported scheme.
- Parse ODBC/ADO.NET `Key=Value;Key2=Value2;...` strings, including the common
  alternate key spellings (`Data Source`, `Uid`, `Pwd`, `Initial Catalog`, ...).
- Redact the password out of the input string instead of ever printing it.
- Flag `mongodb+srv` strings that carry a port, more than one hostname, or
  leave TLS implicit, since the driver resolves the real host list from a DNS
  SRV record at connect time.
- `--json` flag for structured output.
- `--check-only` flag with a three-way exit code (0 clean, 1 parsed with
  warnings, 2 not recognized) for use in CI or a pre-commit hook.
- Read the connection string from an argument or from stdin.
