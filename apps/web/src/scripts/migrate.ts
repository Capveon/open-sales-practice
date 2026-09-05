import { closeDb, migrate } from "../lib/db";

await migrate();
await closeDb();
console.log("schema ready");
