import pg from "pg";
import fs from "fs";
import path from "path";

if (!process.argv.includes("--confirm-delete-all")) {
    console.error(
        "Refusing to wipe Workspace table without explicit --confirm-delete-all flag.\nUsage: node scripts/clean_all_workspaces.mjs --confirm-delete-all"
    );
    process.exit(1);
}

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!dbUrlMatch?.[1]) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}
const connectionString = dbUrlMatch[1];

async function cleanAll() {
    const pool = new pg.Pool({ connectionString });
    try {
        console.log("Deleting all workspaces from database...");
        const res = await pool.query('DELETE FROM "Workspace" RETURNING id;');
        console.log(`Deleted ${res.rowCount} workspaces. Database is now completely fresh!`);
    } catch (err) {
        console.error("Deletion failed:", err);
    } finally {
        await pool.end();
    }
}

cleanAll();
