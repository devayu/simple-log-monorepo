import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const runMigrations = async () => {
  const connection = postgres(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  console.log("Running migrations...");

  await migrate(db, { migrationsFolder: "drizzle" });

  console.log("Migrations completed!");

  await connection.end();
};

runMigrations().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
