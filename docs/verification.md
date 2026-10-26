# Verification

26 October 2026. The local test suite exercises all 31 CLI commands, migration and seed idempotence, case-insensitive lookup and ambiguous matches, signed minute history, attendance protection after a correction, dates, cross-board links, CSV/XLSX import mapping, invalid rows, duplicate and changed source actions, mixed committees, dry-run rollback, JSON/CSV exports and HTML escaping.

PGlite passed 135 assertions. Postgres 18.4 passed 129 assertions; the six additional PGlite assertions exercise child-process CLI and renderer exits. The manual GitHub workflow defines Linux and Windows with Node 20/22 plus Postgres 17. A configured workflow is not evidence it has run.

No authenticated Diligent export or customer records were used. Fixtures are fictional. Vendor documentation verifies the export route, not the current column labels. Validate a real export's mapping and counts before switching. No legal certification, signature verification, multi-user security assessment or disaster-recovery exercise is claimed.

The ExcelJS dependency uses a scoped uuid override to 11.1.1 or later within major 11. npm audit reports zero vulnerabilities after that override; XLSX reading and writing are exercised by the smoke tests.
