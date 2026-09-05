import { migrate } from "../lib/db";

await migrate();
console.log("schema ready");
