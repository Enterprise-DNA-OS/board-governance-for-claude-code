#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { parseCsv } from "./lib/csv.mjs";
import { table } from "./lib/format.mjs";

export const commands = {
  help: "help",
  boards: "boards",
  meetings: "meetings",
  "board-week": "board-week",
  actions: "actions",
  attention: "attention",
  "minute-book": "minute-book",
  decisions: "decisions",
  interests: "interests",
  compliance: "compliance",
  insights: "insights",
  show: "show <meeting>",
  history: "history <meeting>",
  "add-board":
    "add-board --code= --name= --jurisdiction=NZ|AU --secretary= --quorum= --actor=",
  "add-meeting":
    "add-meeting <board> --code= --name= --date=YYYY-MM-DD --chair= --location= --actor=",
  "add-agenda":
    "add-agenda <meeting> --position= --name= --presenter= --purpose=note|discuss|decide --paper= --actor=",
  attendance:
    "attendance <meeting> --name= --role=director|guest --present=yes|no --actor=",
  "hold-meeting": "hold-meeting <meeting> --actor=",
  "record-minutes": "record-minutes <meeting> --file= --actor=",
  "sign-minutes":
    "sign-minutes <meeting> --signer= --signed-on= --evidence= --actor=",
  "record-decision":
    "record-decision <meeting> --code= --name= --outcome=passed|rejected|deferred --evidence= --actor=",
  "add-action":
    "add-action <board> --code= --name= --owner= --due= --meeting= --resolution= --actor=",
  "update-action":
    "update-action <action> --owner= --due= --status= --evidence= --actor=",
  "declare-interest":
    "declare-interest <board> --code= --name= --director= --details= --declared-on= --review-on= --actor=",
  "disclose-interest":
    "disclose-interest <interest> --date= --review-on= --evidence= --actor=",
  log: "log <meeting> --note= --actor=",
  import:
    "import diligent-boards <actions.xlsx|csv> --board= --source= --mapping= --sheet= --date-format=iso|dmy|mdy --actor= [--dry-run]",
  imports: "imports",
  export: "export --out= [--format=json|csv]",
  "weekly-review": "weekly-review",
  "draft-minutes": "draft-minutes <meeting>",
};
const schema = {
  help: [0, []],
  boards: [0, []],
  meetings: [0, []],
  "board-week": [0, []],
  actions: [0, []],
  attention: [0, []],
  "minute-book": [0, []],
  decisions: [0, []],
  interests: [0, []],
  compliance: [0, []],
  insights: [0, []],
  show: [1, []],
  history: [1, []],
  imports: [0, []],
  "add-board": [0, ["code", "name", "jurisdiction", "secretary", "quorum"]],
  "add-meeting": [1, ["code", "name", "date", "chair", "location"]],
  "add-agenda": [1, ["position", "name", "presenter", "purpose", "paper"]],
  attendance: [1, ["name", "role", "present"]],
  "hold-meeting": [1, []],
  "record-minutes": [1, ["file"]],
  "sign-minutes": [1, ["signer", "signed-on", "evidence"]],
  "record-decision": [1, ["code", "name", "outcome", "evidence"]],
  "add-action": [1, ["code", "name", "owner", "due", "meeting", "resolution"]],
  "update-action": [1, ["owner", "due", "status", "evidence"]],
  "declare-interest": [
    1,
    ["code", "name", "director", "details", "declared-on", "review-on"],
  ],
  "disclose-interest": [1, ["date", "review-on", "evidence"]],
  log: [1, ["note"]],
  import: [2, ["board", "source", "mapping", "sheet", "date-format"]],
  export: [0, ["out", "format"]],
  "weekly-review": [0, []],
  "draft-minutes": [1, []],
};
const writes = new Set([
  "add-board",
  "add-meeting",
  "add-agenda",
  "attendance",
  "hold-meeting",
  "record-minutes",
  "sign-minutes",
  "record-decision",
  "add-action",
  "update-action",
  "declare-interest",
  "disclose-interest",
  "log",
  "import",
]);
const req = (o, k) => {
  if (typeof o[k] !== "string" || !o[k].trim())
    throw Error(`--${k} is required`);
  return o[k].trim();
};
const choice = (v, allowed) => {
  if (!allowed.includes(v))
    throw Error(`Expected one of ${allowed.join(", ")}`);
  return v;
};
export const date = (v) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw Error("Use a valid YYYY-MM-DD date");
  return v;
};
const positive = (v) => {
  if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 10000)
    throw Error("Expected a positive integer up to 10000");
  return Number(v);
};
const today = () => new Date().toISOString().slice(0, 10);
function args(a) {
  const [cmd = "help", ...rest] = a;
  if (!schema[cmd]) throw Error("Unknown command. Use help.");
  const pos = [],
    o = {};
  for (const v of rest) {
    if (v.startsWith("--")) {
      const i = v.indexOf("="),
        k = v.slice(2, i < 0 ? undefined : i);
      if (k in o) throw Error(`Duplicate option --${k}`);
      o[k] = i < 0 ? true : v.slice(i + 1);
    } else pos.push(v);
  }
  const allowed = [
    ...schema[cmd][1],
    "json",
    ...(writes.has(cmd) ? ["actor", "dry-run"] : []),
  ];
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) throw Error(`Unknown option --${k}`);
    if (["json", "dry-run"].includes(k)) {
      if (o[k] !== true) throw Error(`--${k} takes no value`);
    } else if (typeof o[k] !== "string") throw Error(`--${k} needs a value`);
  }
  if (pos.length !== schema[cmd][0]) throw Error("Usage: " + commands[cmd]);
  return { cmd, pos, o };
}
const names = new Set([
  "boards",
  "meetings",
  "actions",
  "interests",
  "resolutions",
]);
async function resolve(db, t, q) {
  if (!names.has(t)) throw Error("Invalid record type");
  const rows = await db.query(
    `select * from ${t} where lower(code)=lower($1) or lower(name)=lower($1) order by code`,
    [q],
  );
  const found = rows.length
    ? rows
    : await db.query(
        `select * from ${t} where starts_with(id::text,lower($1)) or strpos(lower(name),lower($1))>0 order by code`,
        [q],
      );
  if (!found.length) throw Error(`No matching ${t}: ${q}`);
  if (found.length > 1)
    throw Error(
      "Ambiguous record; choose a code:\n" +
        found.map((x) => `${x.code} | ${x.name} | ${x.id}`).join("\n"),
    );
  return found[0];
}
async function add(db, t, fields) {
  const keys = Object.keys(fields);
  return (
    await db.query(
      `insert into ${t}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning *`,
      Object.values(fields),
    )
  )[0];
}
async function audit(db, t, id, actor, action, detail) {
  return add(db, "events", {
    entity_type: t,
    entity_id: id,
    actor,
    action,
    detail: JSON.stringify(detail),
  });
}
const reads = {
  boards:
    "select code,name,jurisdiction,secretary,quorum from boards order by code",
  meetings:
    "select code,name,board,held_on,chair,state,present_directors,quorum from meeting_register order by held_on,code",
  "board-week": "select * from board_week",
  actions:
    "select code,name,board,owner,due_on,status,days_overdue from action_register order by days_overdue desc,code",
  attention: "select * from attention order by due nulls first,code,issue",
  "minute-book":
    "select code,name,board,held_on,minute_version,signed_on,first_recorded_on,retention_until from meeting_register where state='held' order by held_on",
  decisions:
    "select r.code,r.name,m.code as meeting,r.outcome,r.evidence from resolutions r join meetings m on m.id=r.meeting_id order by r.created_at,r.code",
  interests:
    "select i.code,i.name,b.name as board,i.director,i.declared_on,i.disclosed_on,i.review_on from interests i join boards b on b.id=i.board_id order by i.review_on",
  compliance: "select * from compliance_findings order by rule,code",
  imports:
    "select source,file_name,sha256,added,skipped,actor,created_at from imports order by created_at",
};
export const questions = [
  [
    "Which owners have overdue actions across boards?",
    "select owner,count(*)::int as overdue,max(days_overdue) as oldest_days from action_register where days_overdue>0 group by owner order by overdue desc",
  ],
  [
    "Which decisions still have unfinished follow-up?",
    "select r.code,r.name,count(a.id)::int as open_actions from resolutions r join actions a on a.resolution_id=r.id and a.status not in ('done','cancelled') group by r.id order by r.code",
  ],
  [
    "Which upcoming decisions have no supporting paper?",
    "select m.code as meeting,a.name,a.presenter from agenda_items a join meetings m on m.id=a.meeting_id where m.state='planned' and a.purpose='decide' and trim(a.paper_ref)='' order by m.held_on",
  ],
  [
    "Which meetings have unsigned latest minutes?",
    "select code,name,board,held_on from meeting_register where state='held' and minute_version is not null and signed_on is null order by held_on",
  ],
  [
    "Which Australian meetings were recorded late?",
    "select code,name,first_recorded_on,au_record_due from meeting_register where jurisdiction='AU' and first_recorded_on>au_record_due order by held_on",
  ],
  [
    "Which NZ meetings have a retention gap?",
    "select code,name,held_on,retention_until from meeting_register where jurisdiction='NZ' and state='held' and (retention_until is null or retention_until<(held_on+interval '7 years')::date) order by held_on",
  ],
  [
    "Which recorded meetings were below configured quorum?",
    "select code,name,present_directors,quorum from meeting_register where state='held' and present_directors<quorum order by held_on",
  ],
  [
    "Which declared interests still need disclosure evidence?",
    "select code,name,director,declared_on from interests where disclosed_on is null order by declared_on",
  ],
  [
    "Which imported actions still lack an owner or date?",
    "select code,name,owner,due_on from actions where source_key is not null and status not in ('done','cancelled') and (trim(owner)='' or due_on is null) order by code",
  ],
  [
    "Which people have both overdue actions and overdue interests?",
    "select distinct a.owner,i.code as interest,i.review_on from action_register a join interests i on lower(i.director)=lower(a.owner) where a.days_overdue>0 and i.review_on<current_date order by a.owner",
  ],
];
async function details(db, m) {
  return {
    meeting: m,
    agenda: await db.query(
      "select position,name,presenter,purpose,paper_ref from agenda_items where meeting_id=$1 order by position",
      [m.id],
    ),
    attendance: await db.query(
      "select name,role,present from attendance where meeting_id=$1 order by name",
      [m.id],
    ),
    minutes: await db.query(
      "select version,body,recorded_on,author,signed_by,signed_on,signature_ref from minutes where meeting_id=$1 order by version",
      [m.id],
    ),
    decisions: await db.query(
      "select code,name,outcome,evidence from resolutions where meeting_id=$1 order by code",
      [m.id],
    ),
    actions: await db.query(
      "select code,name,owner,due_on,status from actions where meeting_id=$1 order by code",
      [m.id],
    ),
  };
}
function privateWrite(dir, name, body) {
  const root = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, dir);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, name);
  fs.writeFileSync(file, body, { flag: "wx", mode: 0o600 });
  return file;
}
export function display(v) {
  if (Array.isArray(v)) {
    if (!v.length) return "(none)";
    return table(
      v,
      Object.keys(v[0]).map((k) => ({
        key: k,
        label: k,
        format: (x) =>
          x && typeof x === "object" ? JSON.stringify(x) : String(x ?? ""),
      })),
    );
  }
  return JSON.stringify(v, null, 2);
}
async function readWorkbook(file, sheet) {
  if (fs.statSync(file).size > 20 * 1024 * 1024)
    throw Error("Import exceeds 20 MB");
  if (path.extname(file).toLowerCase() === ".csv")
    return parseCsv(fs.readFileSync(file, "utf8"));
  if (path.extname(file).toLowerCase() !== ".xlsx")
    throw Error("Expected .xlsx or .csv");
  const w = new ExcelJS.Workbook();
  await w.xlsx.readFile(file);
  if (!sheet && w.worksheets.length !== 1)
    throw Error(
      "Multiple worksheets: select --sheet=" +
        w.worksheets.map((s) => s.name).join("|"),
    );
  const s = sheet ? w.getWorksheet(sheet) : w.worksheets[0];
  if (!s) throw Error("Worksheet not found");
  const text = (c) => {
    const v = c.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object") {
      if ("formula" in v || "sharedFormula" in v)
        throw Error("Formula cells are not accepted in imports");
      if (v.richText) return v.richText.map((t) => t.text).join("");
      if ("text" in v) return String(v.text);
      throw Error("Unsupported workbook cell");
    }
    return String(v);
  };
  let heads;
  const rows = [];
  s.eachRow((row) => {
    const vals = Array.from({ length: s.columnCount }, (_, i) =>
      text(row.getCell(i + 1)),
    );
    if (vals.every((x) => !x.trim())) return;
    if (!heads) {
      heads = vals.map((x) => x.trim());
      while (heads.at(-1) === "") heads.pop();
      if (
        heads.some((x) => !x) ||
        new Set(heads.map((x) => x.toLowerCase())).size !== heads.length
      )
        throw Error("Workbook requires unique nonempty column names");
      return;
    }
    if (vals.slice(heads.length).some(Boolean))
      throw Error("Workbook has unlabelled data columns");
    rows.push(Object.fromEntries(heads.map((h, i) => [h, vals[i]])));
  });
  return rows;
}
const aliases = {
  name: ["Action", "Action item", "Description", "Title"],
  owner: ["Assignee(s)", "Assignees", "Assigned to", "Assignee", "Owner"],
  due: ["Due date", "Due"],
  status: ["Status"],
  id: ["Action ID", "ID"],
  meeting: ["Meeting", "Minutes title"],
  committee: ["Committee", "Board"],
};
async function importActions(db, pos, o, actor) {
  if (pos[0] !== "diligent-boards")
    throw Error("Supported import: diligent-boards");
  const board = await resolve(db, "boards", req(o, "board")),
    source = req(o, "source"),
    file = path.resolve(pos[1]);
  const rows = await readWorkbook(file, o.sheet);
  if (!rows.length) throw Error("Import has no data rows");
  if (rows.length > 10000) throw Error("Import exceeds 10000 rows");
  const map = o.mapping ? JSON.parse(fs.readFileSync(o.mapping, "utf8")) : {};
  for (const [k, v] of Object.entries(map))
    if (!(k in aliases) || typeof v !== "string")
      throw Error("Mapping keys: " + Object.keys(aliases).join(", "));
  const heads = Object.keys(rows[0]),
    columns = {};
  for (const [k, names] of Object.entries(aliases)) {
    const matches = heads.filter((h) =>
      (map[k] ? [map[k]] : names).some(
        (n) => n.toLowerCase() === h.toLowerCase(),
      ),
    );
    if (matches.length > 1)
      throw Error(`Ambiguous ${k} columns; provide --mapping`);
    if (map[k] && !matches.length)
      throw Error(`Missing mapped column ${map[k]}`);
    columns[k] = matches[0];
  }
  if (!columns.name)
    throw Error("Missing action description column; provide --mapping");
  const committees = new Set(
    rows
      .map((r) =>
        columns.committee ? r[columns.committee].trim().toLowerCase() : "",
      )
      .filter(Boolean),
  );
  if (committees.size > 1)
    throw Error(
      "Multiple committees in export; filter and import one board or committee at a time",
    );
  const dateFormat = choice(o["date-format"] || "iso", ["iso", "dmy", "mdy"]);
  const importDate = (v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return date(v);
    if (dateFormat === "iso")
      throw Error("Use ISO dates or specify --date-format=dmy|mdy");
    const match = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) throw Error("Use a valid date with a four-digit year");
    const [, a, b, y] = match;
    return date(
      `${y}-${(dateFormat === "dmy" ? b : a).padStart(2, "0")}-${(dateFormat === "dmy" ? a : b).padStart(2, "0")}`,
    );
  };
  let added = 0,
    skipped = 0;
  const seen = new Set();
  for (const row of rows) {
    const get = (k) => (columns[k] ? row[columns[k]].trim() : "");
    const name = get("name");
    if (!name) throw Error("Blank action description");
    const statusRaw = get("status").toLowerCase(),
      statuses = {
        "": "open",
        open: "open",
        "not started": "open",
        "in progress": "in-progress",
        "in-progress": "in-progress",
        completed: "done",
        complete: "done",
        done: "done",
        cancelled: "cancelled",
        canceled: "cancelled",
      };
    if (!(statusRaw in statuses))
      throw Error(`Unrecognised action status: ${get("status")}`);
    const due = importDate(get("due"));
    const canonical = JSON.stringify(
      Object.fromEntries(
        Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    const identity =
      get("id") || JSON.stringify([get("committee"), get("meeting"), name]);
    const key = createHash("sha256")
      .update(board.id + "\n" + source + "\n" + identity)
      .digest("hex");
    if (seen.has(key))
      throw Error(
        "Duplicate action identity in import; provide stable Action ID values",
      );
    seen.add(key);
    const old = (
      await db.query("select * from actions where source_key=$1", [key])
    )[0];
    if (old) {
      if (old.source_row.canonical !== canonical)
        throw Error(
          "Changed source action; reconcile explicitly before reimport",
        );
      skipped++;
      continue;
    }
    const code = "IMP-" + key.slice(0, 16),
      status = statuses[statusRaw];
    const a = await add(db, "actions", {
      board_id: board.id,
      code,
      name,
      owner: get("owner"),
      due_on: due,
      status,
      completion_evidence: ["done", "cancelled"].includes(status)
        ? "Historical status from imported source; closure evidence not independently verified"
        : "",
      source_key: key,
      source_row: JSON.stringify({
        canonical,
        row,
        source,
        file: path.basename(file),
      }),
    });
    await audit(db, "actions", a.id, actor, "import", { source, code });
    added++;
  }
  const result = {
    source,
    file_name: path.basename(file),
    sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    added,
    skipped,
    actor,
  };
  await add(db, "imports", result);
  return {
    ...result,
    dry_run: !!o["dry-run"],
    note: "Actions only. No meetings, votes, signed minutes, attachments or permissions imported. Preserve source exports and reconcile counts.",
  };
}
export async function run(db, a) {
  const { cmd, pos, o } = args(a);
  if (cmd === "help")
    return Object.entries(commands).map(([command, usage]) => ({
      command,
      usage,
    }));
  if (reads[cmd]) return db.query(reads[cmd]);
  if (cmd === "insights") {
    const out = [];
    for (const [question, sql] of questions)
      out.push({ question, answer: await db.query(sql) });
    return out;
  }
  if (cmd === "show") return details(db, await resolve(db, "meetings", pos[0]));
  if (cmd === "history") {
    const m = await resolve(db, "meetings", pos[0]);
    return db.query(
      "select actor,action,detail,created_at from events where (entity_type='meetings' and entity_id=$1) or detail->>'meeting_id'=$1::text order by created_at,id",
      [m.id],
    );
  }
  if (cmd === "export") {
    const out = path.resolve(req(o, "out")),
      format = choice(o.format || "json", ["json", "csv"]);
    let body;
    await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      if (format === "csv") {
        const rows = await db.query(
          "select code,name,owner,due_on,status,board,meeting,resolution,completion_evidence from action_register order by code",
        );
        const keys = [
          "code",
          "name",
          "owner",
          "due_on",
          "status",
          "board",
          "meeting",
          "resolution",
          "completion_evidence",
        ];
        const quote = (v) =>
          '"' +
          String(v ?? "")
            .replace(/^[=+@\-\t\r]/, "'$&")
            .replace(/"/g, '""') +
          '"';
        body =
          [
            keys.join(","),
            ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
          ].join("\r\n") + "\r\n";
      } else {
        const records = {};
        for (const t of [
          "boards",
          "meetings",
          "agenda_items",
          "attendance",
          "minutes",
          "resolutions",
          "actions",
          "interests",
          "events",
          "imports",
        ])
          records[t] = await db.query(`select * from ${t} order by id`);
        body =
          JSON.stringify(
            {
              format: "board-governance-v1",
              exported_at: new Date().toISOString(),
              records,
            },
            null,
            2,
          ) + "\n";
      }
    } finally {
      await db.exec("ROLLBACK");
    }
    fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
    fs.writeFileSync(out, body, { flag: "wx", mode: 0o600 });
    return { file: out, format };
  }
  if (cmd === "weekly-review" || cmd === "draft-minutes") {
    let body;
    if (cmd === "weekly-review") {
      const sections = [];
      for (const c of ["board-week", "attention", "compliance"])
        sections.push("## " + c + "\n\n" + display(await run(db, [c])));
      body = "# Draft weekly board review\n\n" + sections.join("\n\n");
    } else {
      const m = await resolve(db, "meetings", pos[0]);
      body =
        "# Draft minutes preparation\n\nUse the actual meeting record. Do not infer attendance, decisions or votes from agenda items.\n\n" +
        JSON.stringify(await details(db, m), null, 2);
    }
    return {
      file: privateWrite(
        "drafts",
        `${cmd}-${Date.now()}-${randomUUID().slice(0, 8)}.md`,
        body + "\n",
      ),
    };
  }
  const actor = req(o, "actor");
  await db.exec("BEGIN");
  try {
    let result,
      entity = "meetings",
      eventId,
      detail = {};
    if (cmd === "import") result = await importActions(db, pos, o, actor);
    else if (cmd === "add-board") {
      entity = "boards";
      result = await add(db, entity, {
        code: req(o, "code"),
        name: req(o, "name"),
        jurisdiction: choice(req(o, "jurisdiction"), ["NZ", "AU"]),
        secretary: req(o, "secretary"),
        quorum: positive(req(o, "quorum")),
      });
    } else if (cmd === "add-meeting") {
      const b = await resolve(db, "boards", pos[0]),
        d = date(req(o, "date"));
      result = (
        await db.query(
          "insert into meetings(board_id,code,name,held_on,chair,location,retention_until) values($1,$2,$3,$4,$5,$6,case when $7='NZ' then ($4::date+interval '7 years')::date else null end) returning *",
          [
            b.id,
            req(o, "code"),
            req(o, "name"),
            d,
            req(o, "chair"),
            o.location || "",
            b.jurisdiction,
          ],
        )
      )[0];
    } else if (
      [
        "add-agenda",
        "attendance",
        "hold-meeting",
        "record-minutes",
        "sign-minutes",
        "record-decision",
        "log",
      ].includes(cmd)
    ) {
      const m = await resolve(db, "meetings", pos[0]);
      eventId = m.id;
      detail.meeting_id = m.id;
      if (m.state === "cancelled") throw Error("Meeting cancelled");
      const latest = (
        await db.query(
          "select * from minutes where meeting_id=$1 order by version desc limit 1",
          [m.id],
        )
      )[0];
      if (cmd === "add-agenda") {
        if (m.state !== "planned")
          throw Error("Agenda changes require a planned meeting");
        result = await add(db, "agenda_items", {
          meeting_id: m.id,
          position: positive(req(o, "position")),
          name: req(o, "name"),
          presenter: req(o, "presenter"),
          purpose: choice(req(o, "purpose"), ["note", "discuss", "decide"]),
          paper_ref: o.paper || "",
        });
      } else if (cmd === "attendance") {
        if (latest?.signed_on)
          throw Error("Signed attendance history cannot be changed");
        const present = choice(req(o, "present"), ["yes", "no"]) === "yes",
          name = req(o, "name"),
          role = choice(req(o, "role"), ["director", "guest"]);
        const existing = (
          await db.query(
            "select id from attendance where meeting_id=$1 and lower(name)=lower($2)",
            [m.id, name],
          )
        )[0];
        result = existing
          ? (
              await db.query(
                "update attendance set present=$1,role=$2 where id=$3 returning *",
                [present, role, existing.id],
              )
            )[0]
          : await add(db, "attendance", {
              meeting_id: m.id,
              name,
              role,
              present,
            });
      } else if (cmd === "hold-meeting") {
        if (m.state !== "planned") throw Error("Meeting already held");
        if (m.held_on > today())
          throw Error("Cannot record a future meeting as held");
        result = (
          await db.query(
            "update meetings set state='held' where id=$1 returning *",
            [m.id],
          )
        )[0];
      } else if (cmd === "record-minutes") {
        if (m.state !== "held") throw Error("Minutes require a held meeting");
        const body = fs.readFileSync(req(o, "file"), "utf8").trim();
        if (!body || body.length > 1000000)
          throw Error("Minutes need text up to 1 MB");
        result = await add(db, "minutes", {
          meeting_id: m.id,
          version: (latest?.version || 0) + 1,
          body,
          author: actor,
        });
      } else if (cmd === "sign-minutes") {
        if (!latest) throw Error("No minutes to sign");
        if (latest.signed_on) throw Error("Minutes already signed");
        const signer = req(o, "signer"),
          d = date(req(o, "signed-on"));
        if (signer.toLowerCase() !== m.chair.toLowerCase())
          throw Error(
            "Record the meeting chair signature; next-meeting chair requires a scoped extension",
          );
        if (d < latest.recorded_on || d > today())
          throw Error(
            "Signature date must be between recording date and today",
          );
        result = (
          await db.query(
            "update minutes set signed_by=$1,signed_on=$2,signature_ref=$3 where id=$4 returning *",
            [signer, d, req(o, "evidence"), latest.id],
          )
        )[0];
      } else if (cmd === "record-decision") {
        if (m.state !== "held") throw Error("Decisions require a held meeting");
        result = await add(db, "resolutions", {
          meeting_id: m.id,
          code: req(o, "code"),
          name: req(o, "name"),
          outcome: choice(req(o, "outcome"), [
            "passed",
            "rejected",
            "deferred",
          ]),
          evidence: req(o, "evidence"),
        });
      } else {
        result = { meeting_id: m.id, note: req(o, "note") };
      }
    } else if (cmd === "add-action") {
      entity = "actions";
      const b = await resolve(db, "boards", pos[0]),
        m = o.meeting ? await resolve(db, "meetings", o.meeting) : null,
        r = o.resolution
          ? await resolve(db, "resolutions", o.resolution)
          : null;
      result = await add(db, entity, {
        board_id: b.id,
        meeting_id: m?.id || null,
        resolution_id: r?.id || null,
        code: req(o, "code"),
        name: req(o, "name"),
        owner: o.owner || "",
        due_on: o.due ? date(o.due) : null,
      });
      detail.meeting_id = m?.id;
    } else if (cmd === "update-action") {
      entity = "actions";
      const a = await resolve(db, entity, pos[0]);
      if (["done", "cancelled"].includes(a.status))
        throw Error(
          "Closed actions are immutable; add a linked correction in meeting history",
        );
      const status = o.status
        ? choice(o.status, ["open", "in-progress", "done", "cancelled"])
        : a.status;
      if (!["owner", "due", "status", "evidence"].some((k) => k in o))
        throw Error("Provide an action change");
      result = (
        await db.query(
          "update actions set owner=$1,due_on=$2,status=$3,completion_evidence=$4 where id=$5 returning *",
          [
            o.owner === undefined ? a.owner : req(o, "owner"),
            o.due === undefined ? a.due_on : date(req(o, "due")),
            status,
            ["done", "cancelled"].includes(status)
              ? req(o, "evidence")
              : o.evidence || a.completion_evidence,
            a.id,
          ],
        )
      )[0];
      detail.meeting_id = a.meeting_id;
      detail.before = a;
    } else if (cmd === "declare-interest") {
      entity = "interests";
      const b = await resolve(db, "boards", pos[0]),
        declared = date(req(o, "declared-on")),
        review = date(req(o, "review-on"));
      if (declared > today() || review < declared)
        throw Error("Interest dates out of order");
      result = await add(db, entity, {
        board_id: b.id,
        code: req(o, "code"),
        name: req(o, "name"),
        director: req(o, "director"),
        details: req(o, "details"),
        declared_on: declared,
        review_on: review,
      });
    } else if (cmd === "disclose-interest") {
      entity = "interests";
      const i = await resolve(db, entity, pos[0]),
        d = date(req(o, "date")),
        review = date(req(o, "review-on"));
      if (d > today() || d < i.declared_on || review < d)
        throw Error("Disclosure dates out of order");
      result = (
        await db.query(
          "update interests set disclosed_on=$1,review_on=$2,evidence=$3 where id=$4 returning *",
          [d, review, req(o, "evidence"), i.id],
        )
      )[0];
      detail.before = i;
    } else throw Error("Command not implemented");
    if (cmd !== "import")
      await audit(db, entity, eventId || result.id, actor, cmd, {
        ...detail,
        result,
      });
    await db.exec(o["dry-run"] ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(
      process.argv.includes("--json")
        ? JSON.stringify(result, null, 2)
        : display(result),
    );
  } catch (e) {
    console.error(
      process.argv.includes("--json")
        ? JSON.stringify({ error: e.message })
        : e.message,
    );
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
