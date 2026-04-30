import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const flagsPath = path.join(root, "src/lib/flags.ts");
const schemaPath = path.join(root, "supabase/schema.sql");

const flagsSource = fs.readFileSync(flagsPath, "utf8");
const schemaSource = fs.readFileSync(schemaPath, "utf8");

const specialFlags = Object.fromEntries(
  [...flagsSource.matchAll(/^\s*([A-Z]{3}):\s*"([^"]+)"\s*,?\s*$/gm)].filter(([, code, value]) => value.includes("\\u{1F3F4}") || value.includes("🏴"))
    .map(([, code, value]) => [code, decodeEscapes(value)])
);

const codeToIso2 = Object.fromEntries(
  [...flagsSource.matchAll(/^\s*([A-Z]{3}):\s*"([A-Z]{2})"\s*,?\s*$/gm)].map(([, code, iso2]) => [code, iso2])
);

const teamCodes = [...schemaSource.matchAll(/\('([^']+)',\s*'([A-Z]{3})'\)/g)].map(([, name, code]) => ({
  name,
  code
}));

function decodeEscapes(value) {
  return new Function(`return "${value}";`)();
}

function iso2ToFlag(iso2) {
  if (iso2.length !== 2) return "";
  const base = 0x1f1e6;
  const [a, b] = iso2.toUpperCase();
  return String.fromCodePoint(base + (a.charCodeAt(0) - 65), base + (b.charCodeAt(0) - 65));
}

function flagForCode(code) {
  if (specialFlags[code]) return specialFlags[code];
  if (codeToIso2[code]) return iso2ToFlag(codeToIso2[code]);
  return "";
}

const rows = teamCodes.map((team) => ({
  ...team,
  flag: flagForCode(team.code)
}));

const unmapped = rows.filter((row) => !row.flag);
const duplicates = rows.reduce((acc, row) => {
  if (!row.flag) return acc;
  acc[row.flag] ??= [];
  acc[row.flag].push(row);
  return acc;
}, {});

const duplicateGroups = Object.entries(duplicates)
  .map(([flag, teams]) => ({ flag, teams }))
  .filter(({ teams }) => teams.length > 1);

console.log(`Checked ${rows.length} team codes.`);

if (unmapped.length) {
  console.log("\nUnmapped codes:");
  for (const row of unmapped) {
    console.log(`- ${row.code} ${row.name}`);
  }
} else {
  console.log("\nNo unmapped codes.");
}

if (duplicateGroups.length) {
  console.log("\nDuplicate rendered flags:");
  for (const group of duplicateGroups) {
    console.log(`- ${group.flag} ${group.teams.map((team) => `${team.code} ${team.name}`).join(", ")}`);
  }
} else {
  console.log("\nNo duplicate rendered flags.");
}

console.log("\nRendered flags:");
for (const row of rows) {
  console.log(`- ${row.flag || "?"} ${row.code} ${row.name}`);
}
