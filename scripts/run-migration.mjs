import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const url = new URL(process.env.POSTGRES_URL_NON_POOLING);
url.searchParams.set("uselibpqcompat", "true");
url.searchParams.set("sslmode", "require");
const client = new Client({ connectionString: url.toString() });

await client.connect();
try {
  await client.query(sql);
  console.log("Migration applied successfully.");
} finally {
  await client.end();
}
