# Company board record checks

Scope: internal secretary support for NZ and Australian companies. Sources checked 26 October 2026. These checks report evidence gaps. They are not a legal opinion, a compliance certificate or a test of legal validity.

| Rule | Source and implementation |
|---|---|
| NZ-189-minutes | [Companies Office company records guidance](https://companies-register.companiesoffice.govt.nz/help-centre/complying-with-the-law/keeping-company-records/) identifies board and committee minutes and resolutions as required company records. The report flags a recorded held meeting with no minute record. |
| NZ-189-retention | The same guidance requires the listed company records to be retained for seven years. New NZ meetings get a retention date seven calendar years after the meeting. A held meeting with a shorter or missing date is flagged. Nothing is automatically deleted. |
| AU-251A-record | [ASIC INFO 186](https://asic.gov.au/about-asic/contact-us/reporting-misconduct-to-asic/disputes-about-access-to-company-information/) explains recording proceedings and resolutions within one month. The deadline is one calendar month, not 30 days. The report compares the first stored minute record with that deadline. Recording late remains a finding after a later signature. |
| AU-251A-signature | ASIC identifies signing by the meeting chair or next meeting chair within a reasonable time. The base records the meeting chair's signature evidence only. An unsigned latest minute version is an evidence gap, not a claim that a fixed statutory signing deadline has expired. |

Dates use UTC calendar days. Recording time is the database's current date and cannot be supplied through the CLI. The report does not backdate a late record. A source minute recorded elsewhere before migration needs a deliberate extension with evidence of its original recording date; do not import it as if its local timestamp proved the historical deadline was met.

Signature references do not verify the signed document, signer identity, electronic-signature law or authority. Keep originals in controlled storage. A typed --signer is an operator assertion. The base does not implement signing by the next meeting chair; scope that flow before using it.

## Local controls

LOCAL-quorum compares recorded directors present against the board's configured quorum. It does not apply a statutory default, count eligible voters, assess conflicts or determine meeting validity. Set the value from the applicable constitution and rules. Guests do not count.

LOCAL-interest-review flags missing disclosure evidence or an overdue review date. Review dates are business controls, not a statutory annual deadline. Disclosure duties depend on the entity and transaction. The operator must determine whether a declaration is complete and how the interest affects participation.

Signed minutes are immutable. Corrections append a new version; that latest version needs its own signature evidence. Signed meeting details and attendance cannot be changed. Recorded resolutions and audit events are append-only. No deletion command ships. This is not tamper-proof storage against a database owner.

The report covers only records entered. It does not discover missing meetings, verify that papers are retained, inspect storage location, authenticate directors, satisfy a litigation hold or prove an entire seven-year archive exists. Entity registers, shareholder records, financial records, filings and regulated-sector obligations are outside this base. Australian records are never assigned the NZ deletion schedule; no record is deleted automatically in either jurisdiction.
