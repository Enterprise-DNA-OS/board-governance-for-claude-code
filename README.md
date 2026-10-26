# Board Governance for Claude Code

Keep the board's decisions connected to the work they require. Prepare meetings, retain minutes, record interests and follow overdue actions across committees in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install and operate it yourself. | Your board rules, fields, documents and reports. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | One setup fee, then a retainer. [Build our version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=diligent-boards) | One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=diligent-boards) |

## The annual bill

[Diligent's own AWS Marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-speujf5ixpxuw) lists Board & Leadership Collaboration Essentials at US$48,500, Pro at US$84,500 and Pro Plus at US$155,500 for a 12-month contract. Checked 26 October 2026. These are enterprise package list prices, not a verified NZ or AU customer invoice or a claim about a typical small company's spend. [Diligent's website](https://www.diligent.com/pricing) requests a tailored quote.

This independent project covers the board secretary's recordkeeping and follow-up workflow. It is not affiliated with Diligent. It does not reproduce the secure director portal, private annotations, electronic signatures, protected document distribution, identity assurance or external integrations in the vendor's broader product. Scope those requirements before replacing an existing service.

## Quick start

Node 20 or later. The local database is PGlite; a shared deployment can use Postgres 15 or later.

```bash
git clone https://github.com/Enterprise-DNA-OS/board-governance-for-claude-code.git
cd board-governance-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
node scripts/governance.mjs help
```

Open the folder in Claude Code, Codex, OpenCode or Cursor. All runtimes use the same instructions and commands. Demo records are fictional. Run the demo in a separate database from your business records. Set DATA_DIR to a fresh directory or DATABASE_URL to your own Postgres database, then run npm run migrate before importing business records.

## The secretary's week

- /board-week: meetings in the next fortnight, including overdue preparation.
- /attention: action owners, missing dates, unsigned minutes and overdue interest reviews.
- /minute-book: what was recorded, when, and which version has signature evidence.
- /decisions: decisions and the evidence the secretary recorded.
- /interests: declarations, disclosure evidence and review dates.
- /compliance: NZ retention checks, Australian minute-recording checks and clearly labelled local controls.
- /weekly-review: one draft assembled from the week, attention and compliance reports.

Use /add-board, /add-meeting and /add-agenda to prepare. Record attendance, mark the meeting held, then append minutes. /sign-minutes records the chair's existing signature evidence; it does not create a signature. Corrections append a new minute version. Signed versions and the associated meeting facts remain intact. /record-decision records an outcome and its evidence, not an automatic vote or legal determination. /add-action and /update-action keep the resulting work moving.

Every mutation needs --actor and supports --dry-run. Actor names are audit labels, not authenticated identities. Names and codes match without case sensitivity; ambiguous names list candidates and exit with an error. Every CLI command supports --json.

## Bring your Diligent actions across

Diligent documents an Actions dashboard export to Excel. Filter to one board or committee, export, inspect its headings and run:

```bash
node scripts/governance.mjs import diligent-boards actions.xlsx --board=BOARD-CODE --source=your-diligent-site --actor="Board secretary" --dry-run
node scripts/governance.mjs import diligent-boards actions.xlsx --board=BOARD-CODE --source=your-diligent-site --actor="Board secretary"
```

Use --mapping=examples/column-map.json for different headings, --sheet=Actions for a multi-sheet workbook, and --date-format=dmy or mdy for text dates that are not ISO dates. Missing owners and due dates stay missing and appear in attention. Reconcile added and skipped rows against your filtered export. Original row values stay with each imported action. Identical reimports are skipped; changed source actions stop the whole transaction for reconciliation.

This is a one-command action import, not a whole-portal migration. Meetings, minutes, votes, attachments and permissions need separate reconciliation. [The switching guide](docs/replace-diligent-boards.md) states the exact boundary. The sample export is fictional; no authenticated customer export was available to verify the vendor's current column labels.

## Ten questions to ask your records

Run /insights. These are cross-record questions answered by this build today, not a claim that Diligent cannot produce an equivalent report.

1. Which owners have overdue actions across boards?
2. Which decisions still have unfinished follow-up?
3. Which upcoming decisions have no supporting paper?
4. Which meetings have unsigned latest minutes?
5. Which Australian meetings were recorded late?
6. Which NZ meetings have a retention gap?
7. Which recorded meetings were below configured quorum?
8. Which declared interests still need disclosure evidence?
9. Which imported actions still lack an owner or date?
10. Which people have both overdue actions and overdue interests?

## Documents and views

npm run docs creates meeting preparation packs, minute records and interests registers in docs-out/. npm run view creates the week, attention and minute-book dashboards in views/. These are read-only branded HTML files. Change the business name, logo and colours in brand.json. No web server or interactive front end is required. /new-view adds a report from the database.

## Your first hour: ten things to ask for

1. Put our name and colours on the meeting pack.
2. Add our board, secretary, jurisdiction and actual quorum.
3. Import one committee's action export and reconcile the row count.
4. Assign owners and dates to the incomplete actions.
5. Prepare the agenda for our next board meeting.
6. Show decisions still waiting on follow-up.
7. Record a director's declared interest and disclosure evidence.
8. Show unsigned minutes and late recording separately.
9. Draft the weekly secretary review for inspection.
10. Use /customise to add our paper classification field and test the migration.

## Operating boundaries

Use one database per business and trusted internal operators. There is no authentication service, director portal, notification sender or tenant isolation service in the free base. Row-level security denies untrusted roles by default; the database owner can bypass it. Keep database credentials and exports private. Generated files use restrictive permissions where supported. Protect local disks, restrict file sharing and test native database backups before relying on them. JSON export is a portable record copy, not a tested disaster-recovery restore.

The compliance report checks evidence and dates for the stated NZ and AU company scope. It does not decide whether a meeting or resolution was legally valid, verify a signature, or certify compliance. It cannot detect a meeting never entered. Keep original signed documents, board papers and required legal records in controlled storage. See [compliance](docs/compliance.md) and [why no front end](docs/why-no-front-end.md).

npm test uses disposable storage and exercises all 31 CLI commands, signed history, calendar dates, transaction rollback, ambiguous records, exports and generated reports. The manual CI workflow covers Linux and Windows on Node 20/22 plus Postgres. See [verification](docs/verification.md) for the checks actually run.

MIT. Diligent and Diligent Boards are their owners' trademarks.
