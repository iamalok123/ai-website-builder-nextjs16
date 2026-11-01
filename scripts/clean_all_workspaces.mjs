import pg from "pg";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
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
