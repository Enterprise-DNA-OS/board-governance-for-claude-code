import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ExcelJS from "exceljs";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "governance-test-"));
process.env.DATA_DIR = path.join(temp, "db");
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const { getDb, REPO_ROOT } = await import("./lib/db.mjs");
const { migrate } = await import("./migrate.mjs");
const { seed } = await import("./seed.mjs");
const { run, commands, date } = await import("./governance.mjs");
const { parseCsv } = await import("./lib/csv.mjs");
const { table, page } = await import("./lib/render.mjs");
const db = await getDb(),
  visited = new Set(),
  actor = "--actor=Secretary";
let assertions = 0,
  closed = false;
const eq = (a, b) => {
    assert.deepEqual(a, b);
    assertions++;
  },
  ok = (v) => {
    assert.ok(v);
    assertions++;
  };
const call = async (...a) => {
  visited.add(a[0]);
  return run(db, a);
};
const fail = async (a, re) => {
  await assert.rejects(() => call(...a), re);
  assertions++;
};
const count = async (t) =>
  Number((await db.query(`select count(*) as n from ${t}`))[0].n);
const write = (n, s) => {
  const p = path.join(temp, n);
  fs.writeFileSync(p, s);
  return p;
};
const today = new Date().toISOString().slice(0, 10),
  past = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const schema = "governance_test_" + Date.now();
try {
  if (db.mode === "postgres")
    await db.exec(`create schema ${schema};set search_path to ${schema};`);
  eq((await migrate(db)).ran.length, 2);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  await seed(db);
  eq(await count("boards"), 2);
  eq(await count("meetings"), 5);
  eq(await count("actions"), 5);
  eq(await count("minutes"), 2);
  eq((await call("help")).length, Object.keys(commands).length);
  for (const c of [
    "boards",
    "meetings",
    "board-week",
    "actions",
    "attention",
    "minute-book",
    "decisions",
    "interests",
    "compliance",
  ])
    ok((await call(c)).length > 0);
  eq((await call("insights")).length, 10);
  const nz = await call("show", "nz-last");
  eq(nz.meeting.code, "NZ-LAST");
  eq(
    (await call("show", nz.meeting.id.slice(0, -1) + "1")).meeting.code,
    "NZ-LAST",
  );
  await fail(["show", "review"], /Ambiguous.*AU-LAST/s);
  await fail(["show", "absent"], /No matching/);
  await fail(["boards", "--typo"], /Unknown option/);
  await fail(["boards", "extra"], /Usage/);
  await fail(["boards", "--json=false"], /takes no value/);
  await fail(["add-board", "--code=X"], /actor/);
  await call(
    "add-board",
    "--code=TEST",
    "--name=Test board",
    "--jurisdiction=AU",
    "--secretary=Lee",
    "--quorum=2",
    actor,
  );
  await fail(
    [
      "add-board",
      "--code=test",
      "--name=X",
      "--jurisdiction=AU",
      "--secretary=Lee",
      "--quorum=2",
      actor,
    ],
    /unique|duplicate/,
  );
  await fail(
    [
      "add-board",
      "--code=BAD",
      "--name=X",
      "--jurisdiction=AU",
      "--secretary=Lee",
      "--quorum=2.5",
      actor,
    ],
    /integer/,
  );
  const m = await call(
    "add-meeting",
    "TEST",
    "--code=MT-1",
    "--name=Test governance review",
    "--date=" + past,
    "--chair=Lee",
    actor,
  );
  eq(m.state, "planned");
  eq(m.retention_until, null);
  await fail(
    [
      "add-meeting",
      "TEST",
      "--code=BAD",
      "--name=X",
      "--date=2026-02-30",
      "--chair=Lee",
      actor,
    ],
    /valid/,
  );
  const n = await call(
    "add-meeting",
    "KOWHAI",
    "--code=MT-NZ",
    "--name=Test NZ",
    "--date=2024-02-29",
    "--chair=Lee",
    actor,
  );
  eq(n.retention_until, "2031-02-28");
  await call(
    "add-meeting",
    "TEST",
    "--code=MT-FUT",
    "--name=Future meeting",
    "--date=" + future,
    "--chair=Lee",
    actor,
  );
  await fail(["hold-meeting", "MT-FUT", actor], /future/);
  await call(
    "add-agenda",
    "MT-1",
    "--position=1",
    "--name=Supplier renewal",
    "--presenter=Pat",
    "--purpose=decide",
    actor,
  );
  await fail(
    [
      "add-agenda",
      "MT-1",
      "--position=1",
      "--name=Duplicate",
      "--presenter=Pat",
      "--purpose=decide",
      actor,
    ],
    /unique|duplicate/,
  );
  await call(
    "attendance",
    "MT-1",
    "--name=Lee",
    "--role=director",
    "--present=yes",
    actor,
  );
  await call(
    "attendance",
    "MT-1",
    "--name=Pat",
    "--role=director",
    "--present=no",
    actor,
  );
  await call(
    "attendance",
    "MT-1",
    "--name=pat",
    "--role=director",
    "--present=yes",
    actor,
  );
  eq((await call("show", "MT-1")).attendance.length, 2);
  await fail(
    [
      "record-minutes",
      "MT-1",
      "--file=" + write("minute.txt", "Board discussed the supplier renewal."),
      actor,
    ],
    /held meeting/,
  );
  await call("hold-meeting", "MT-1", actor);
  await fail(["hold-meeting", "MT-1", actor], /already held/);
  await fail(
    [
      "add-agenda",
      "MT-1",
      "--position=2",
      "--name=Late",
      "--presenter=Pat",
      "--purpose=note",
      actor,
    ],
    /planned/,
  );
  const v1 = await call(
    "record-minutes",
    "MT-1",
    "--file=" + path.join(temp, "minute.txt"),
    actor,
  );
  eq(v1.version, 1);
  eq(v1.recorded_on, today);
  await fail(
    [
      "sign-minutes",
      "MT-1",
      "--signer=Wrong",
      "--signed-on=" + today,
      "--evidence=X",
      actor,
    ],
    /chair/,
  );
  await fail(
    [
      "sign-minutes",
      "MT-1",
      "--signer=Lee",
      "--signed-on=" + future,
      "--evidence=X",
      actor,
    ],
    /Signature date/,
  );
  await fail(
    [
      "sign-minutes",
      "MT-1",
      "--signer=Lee",
      "--signed-on=" + past,
      "--evidence=X",
      actor,
    ],
    /Signature date/,
  );
  await call(
    "sign-minutes",
    "MT-1",
    "--signer=Lee",
    "--signed-on=" + today,
    "--evidence=Protected signed record M1",
    actor,
  );
  await fail(
    [
      "sign-minutes",
      "MT-1",
      "--signer=Lee",
      "--signed-on=" + today,
      "--evidence=X",
      actor,
    ],
    /already signed/,
  );
  await fail(
    [
      "attendance",
      "MT-1",
      "--name=Pat",
      "--role=director",
      "--present=no",
      actor,
    ],
    /Signed/,
  );
  await assert.rejects(
    () =>
      db.query("update minutes set body=$1 where id=$2", ["Rewrite", v1.id]),
    /immutable/,
  );
  assertions++;
  await assert.rejects(
    () => db.query("delete from minutes where id=$1", [v1.id]),
    /immutable/,
  );
  assertions++;
  eq(
    (
      await call(
        "record-minutes",
        "MT-1",
        "--file=" +
          write("correction.txt", "Correction: supplier review deferred."),
        actor,
      )
    ).version,
    2,
  );
  eq((await call("show", "MT-1")).minutes[0].signed_by, "Lee");
  await fail(
    [
      "attendance",
      "MT-1",
      "--name=Pat",
      "--role=director",
      "--present=no",
      actor,
    ],
    /Signed/,
  );
  ok(
    (await call("compliance")).some(
      (r) => r.code === "MT-1" && r.rule === "AU-251A-signature",
    ),
  );
  await assert.rejects(
    () =>
      db.query("update attendance set meeting_id=$1 where meeting_id=$2", [
        n.id,
        m.id,
      ]),
    /Signed/,
  );
  assertions++;
  await assert.rejects(
    () =>
      db.query("update meetings set chair=$1 where id=$2", [
        "Other chair",
        m.id,
      ]),
    /Signed/,
  );
  assertions++;
  const dec = await call(
    "record-decision",
    "MT-1",
    "--code=DEC-TEST",
    "--name=Defer supplier vote",
    "--outcome=deferred",
    "--evidence=Minute version 2",
    actor,
  );
  eq(dec.outcome, "deferred");
  await assert.rejects(
    () =>
      db.query("update resolutions set outcome=$1 where id=$2", [
        "passed",
        dec.id,
      ]),
    /append-only/,
  );
  assertions++;
  await fail(
    [
      "add-action",
      "KOWHAI",
      "--code=CROSS",
      "--name=Bad link",
      "--meeting=MT-1",
      actor,
    ],
    /share a board/,
  );
  await fail(
    [
      "add-action",
      "TEST",
      "--code=CROSS",
      "--name=Bad link",
      "--resolution=DEC-TEST",
      actor,
    ],
    /Resolution/,
  );
  const act = await call(
    "add-action",
    "TEST",
    "--code=A-TEST",
    "--name=Get supplier evidence",
    "--meeting=MT-1",
    "--resolution=DEC-TEST",
    actor,
  );
  eq(act.owner, "");
  await call(
    "update-action",
    "A-TEST",
    "--owner=Lee",
    "--due=" + future,
    "--status=in-progress",
    actor,
  );
  await fail(["update-action", "A-TEST", "--status=done", actor], /evidence/);
  await call(
    "update-action",
    "A-TEST",
    "--status=done",
    "--evidence=Receipt 15",
    actor,
  );
  await fail(["update-action", "A-TEST", "--owner=Pat", actor], /immutable/);
  await call(
    "declare-interest",
    "TEST",
    "--code=I-TEST",
    "--name=Supplier directorship",
    "--director=Lee",
    "--details=Director of supplier",
    "--declared-on=" + past,
    "--review-on=" + future,
    actor,
  );
  await fail(
    [
      "disclose-interest",
      "I-TEST",
      "--date=" + future,
      "--review-on=" + future,
      "--evidence=Board note",
      actor,
    ],
    /dates/,
  );
  await call(
    "disclose-interest",
    "I-TEST",
    "--date=" + today,
    "--review-on=" + future,
    "--evidence=Board minute I1",
    actor,
  );
  await call("log", "MT-1", "--note=Paper received", actor);
  ok((await call("history", "MT-1")).length > 10);
  const before = await count("actions"),
    fixture = path.join(REPO_ROOT, "examples/diligent-actions.csv");
  eq(
    (
      await call(
        "import",
        "diligent-boards",
        fixture,
        "--board=TEST",
        "--source=site-A",
        actor,
        "--dry-run",
      )
    ).added,
    2,
  );
  eq(await count("actions"), before);
  eq(await count("imports"), 0);
  eq(
    (
      await call(
        "import",
        "diligent-boards",
        fixture,
        "--board=TEST",
        "--source=site-A",
        actor,
      )
    ).added,
    2,
  );
  eq(
    (
      await call(
        "import",
        "diligent-boards",
        fixture,
        "--board=TEST",
        "--source=site-A",
        actor,
      )
    ).skipped,
    2,
  );
  eq((await call("imports")).length, 2);
  const imp = (
    await db.query(
      "select * from actions where source_key is not null order by code",
    )
  )[0];
  ok(imp.source_row.row["Custom note"]);
  eq(imp.meeting_id, null);
  const changed = write(
    "changed.csv",
    fs.readFileSync(fixture, "utf8").replace("Mara Bell", "New owner"),
  );
  await fail(
    [
      "import",
      "diligent-boards",
      changed,
      "--board=TEST",
      "--source=site-A",
      actor,
    ],
    /Changed source/,
  );
  const rollback = write(
    "rollback.csv",
    "Action ID,Action,Due date\nNEW,Good,2026-12-01\nBAD,Bad,2026-02-30\n",
  );
  await fail(
    [
      "import",
      "diligent-boards",
      rollback,
      "--board=TEST",
      "--source=rollback",
      actor,
    ],
    /valid/,
  );
  eq(await count("actions"), before + 2);
  for (const [name, text, re] of [
    ["duplicate", "Action ID,Action\nX,One\nX,Two\n", /Duplicate action/],
    ["missing", "Not action\nValue\n", /Missing action/],
    ["bad", 'Action\n"Bad', /unclosed/],
    ["status", "Action,Status\nBad,Whatever\n", /Unrecognised/],
  ])
    await fail(
      [
        "import",
        "diligent-boards",
        write(name + ".csv", text),
        "--board=TEST",
        "--source=bad",
        actor,
      ],
      re,
    );
  const wb = new ExcelJS.Workbook(),
    ws = wb.addWorksheet("Actions");
  ws.addRow(["Task key", "Task text", "Owner", "Deadline", "Status"]);
  ws.addRow([
    "XLS-1",
    "Workbook action",
    "Lee",
    new Date("2026-12-05T00:00:00Z"),
    "Open",
  ]);
  const xlsx = path.join(temp, "actions.xlsx");
  await wb.xlsx.writeFile(xlsx);
  const mapping = write(
    "mapping.json",
    JSON.stringify({ id: "Task key", name: "Task text", due: "Deadline" }),
  );
  eq(
    (
      await call(
        "import",
        "diligent-boards",
        xlsx,
        "--board=TEST",
        "--source=xlsx",
        "--mapping=" + mapping,
        actor,
      )
    ).added,
    1,
  );
  eq(
    (
      await db.query("select due_on from actions where name='Workbook action'")
    )[0].due_on,
    "2026-12-05",
  );
  ws.getCell("B2").value = { formula: "1+1", result: 2 };
  await wb.xlsx.writeFile(xlsx);
  await fail(
    [
      "import",
      "diligent-boards",
      xlsx,
      "--board=TEST",
      "--source=formula",
      "--mapping=" + mapping,
      actor,
    ],
    /Formula/,
  );
  await fail(
    [
      "import",
      "diligent-boards",
      fixture,
      "--board=TEST",
      "--source=typo",
      actor,
      "--dryrun",
    ],
    /Unknown/,
  );
  await fail(
    [
      "import",
      "diligent-boards",
      fixture,
      "--board=TEST",
      "--source=typo",
      actor,
      "--dry-run=false",
    ],
    /takes no value/,
  );
  const localized = write(
    "dates.csv",
    "Action ID,Action,Due date,Committee\nLOC,Local date,05/12/2026,One board\n",
  );
  await fail(
    [
      "import",
      "diligent-boards",
      localized,
      "--board=TEST",
      "--source=local",
      actor,
    ],
    /date-format/,
  );
  eq(
    (
      await call(
        "import",
        "diligent-boards",
        localized,
        "--board=TEST",
        "--source=local",
        "--date-format=dmy",
        actor,
      )
    ).added,
    1,
  );
  eq(
    (await db.query("select due_on from actions where name='Local date'"))[0]
      .due_on,
    "2026-12-05",
  );
  const multi = write(
    "multi.csv",
    "Action,Committee\nOne,Board A\nTwo,Board B\n",
  );
  await fail(
    [
      "import",
      "diligent-boards",
      multi,
      "--board=TEST",
      "--source=multi",
      actor,
    ],
    /Multiple committees/,
  );
  const out = path.join(temp, "export.json");
  await call("export", "--out=" + out);
  eq(Object.keys(JSON.parse(fs.readFileSync(out)).records).length, 10);
  await fail(["export", "--out=" + out], /EEXIST/);
  const csv = path.join(temp, "export.csv");
  await call("export", "--out=" + csv, "--format=csv");
  eq(parseCsv(fs.readFileSync(csv, "utf8")).length, await count("actions"));
  for (const c of ["weekly-review", "draft-minutes"]) {
    const x = await call(c, ...(c === "draft-minutes" ? ["MT-1"] : []));
    ok(fs.readFileSync(x.file, "utf8").startsWith("# Draft"));
  }
  for (const v of JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "views.json")),
  ))
    for (const s of v.sections) ok(Array.isArray(await db.query(s.sql)));
  for (const d of JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "documents.json")),
  ))
    for (const r of await db.query(d.for_each))
      for (const s of d.sections)
        ok(Array.isArray(await db.query(s.sql, [r.id])));
  ok(!table([{ name: "<script>alert(1)</script>" }]).includes("<script>"));
  ok(page({ title: "<img onerror=x>", sections: [] }).includes("&lt;img"));
  eq(
    Object.keys(commands).filter((k) => !visited.has(k)),
    [],
  );
  if (db.mode === "postgres")
    await db.exec(`set search_path to public;drop schema ${schema} cascade;`);
  await db.close();
  closed = true;
  if (!process.env.TEST_DATABASE_URL) {
    for (const script of ["view.mjs", "docs.mjs"]) {
      const res = spawnSync(
        process.execPath,
        [path.join(REPO_ROOT, "scripts", script)],
        { env: process.env, encoding: "utf8" },
      );
      eq(res.status, 0);
    }
    const good = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, "scripts/governance.mjs"), "actions", "--json"],
      { env: process.env, encoding: "utf8" },
    );
    eq(good.status, 0);
    ok(Array.isArray(JSON.parse(good.stdout)));
    const bad = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts/governance.mjs"),
        "show",
        "review",
        "--json",
      ],
      { env: process.env, encoding: "utf8" },
    );
    eq(bad.status, 1);
    ok(JSON.parse(bad.stderr).error.includes("Ambiguous"));
  }
  console.log(
    `PASS: ${Object.keys(commands).length} CLI commands, ${assertions} assertions; signed minutes, calendar deadlines, cross-board checks, CSV/XLSX import rollback, reports and export`,
  );
} finally {
  if (!closed) await db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
