# Move board action records from Diligent Boards

Sources checked 26 October 2026: [Exporting action items](https://help.diligentoneplatform.com/helpdocs/boards/en-us/Content/boards-add-ons/minutes/exporting-action-items.htm) and [Exporting minutes](https://help.diligentoneplatform.com/helpdocs/boards/en-us/Content/boards-add-ons/minutes/exporting-minutes.htm).

## Export and preserve

In Minutes, open the Actions dashboard. Filter it to one board or committee and select Export actions report. Diligent says the report reflects your applied filters. A single meeting also has an Actions only export. Keep an untouched copy of the XLSX file and record which filters were applied.

Export minutes separately as Word documents with or without actions. The vendor says minutes in review cannot be exported. Preserve signed originals, attachments and book archives in controlled storage. This importer does not parse Word minutes or recreate signatures.

## Import one board at a time

1. Create an empty business database and run npm run migrate. Do not seed fictional demo records into it.
2. Use add-board to create the destination. Give it a stable code, jurisdiction, secretary and your constitution's quorum.
3. Inspect the export headings. Default aliases include Action or Description, Assignee(s) or Owner, Due date, Status, Action ID, Committee and Minutes title. Vendor documentation confirms XLSX export but does not publish an authoritative column schema. The example headings are a fictional compatibility fixture, not a captured customer export.
4. Run the one import command with --dry-run, then repeat without it once the mapping and counts are right.

```bash
node scripts/governance.mjs add-board --code=MAIN --name="Main board" --jurisdiction=NZ --secretary="Secretary name" --quorum=3 --actor="Secretary name"
node scripts/governance.mjs import diligent-boards actions.xlsx --board=MAIN --source=site-main --mapping=examples/column-map.json --actor="Secretary name" --dry-run
node scripts/governance.mjs import diligent-boards actions.xlsx --board=MAIN --source=site-main --mapping=examples/column-map.json --actor="Secretary name"
```

Remove --mapping when the defaults match. Mapping keys are id, name, owner, due, status, meeting and committee; values are the exact source headings. Unknown or ambiguous mappings stop without writes. Use --sheet for more than one sheet. Save as UTF-8 CSV when required; CSV and XLSX use the same mapping. Excel date cells and ISO text dates work directly. Other numeric text dates require --date-format=dmy or mdy. Formula cells, unknown statuses, duplicate identities and invalid dates fail the transaction.

## What maps

| Source | Destination |
|---|---|
| Action text | Action name |
| Assignees | Owner text, preserved as one field when there are several |
| Due date | Calendar date, or missing |
| Status | Open, in progress, done or cancelled |
| Action ID | Stable import identity within source and destination board |
| Committee and meeting title | Preserved source context, not invented meeting records |
| Extra columns | Preserved with the original row |

The importer rejects multiple distinct committee values. A filtered file without committee headings relies on your verified destination selection. An export with no Action ID uses committee, meeting title and action text as its identity. Changing that text can create a new identity; stable vendor IDs are preferred. Reuse the same --source for the same site and board. Changing --source deliberately creates a separate import identity space.

Existing source rows must match on reimport. Changed source data stops for reconciliation; it never silently overwrites local follow-up. Imported completed or cancelled status is historical, not independently verified closure evidence. All imported actions initially have no local meeting or resolution link.

## Reconcile before switching

Compare imported and skipped counts with the filtered report. Spot-check action text, owners, dates and statuses. Use actions, attention and export to review them. Preserve the source file hash recorded by imports. Reconcile meetings, minutes, signatures, documents, permissions, retention requirements and any portal features separately before ending the incumbent contract. The one-command promise covers action records after mapping, not a certified whole-service switch in a day.
