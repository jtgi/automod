const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const fs = require("fs");

async function updatePermissions() {
  // Open the database
  // fs.copyFileSync("./prisma/dev.db", "./prisma/dev.db.backup");
  const db = await sqlite.open({
    filename: "./prisma/dev.db",
    driver: sqlite3.Database,
  });

  try {
    // SQL query to get all roles
    const getAllRolesQuery = `
      SELECT id, isCohostRole, permissions FROM Role
    `;

    // SQL query to update role permissions
    const updateRolePermissionsQuery = `
      UPDATE Role
      SET permissions = ?
      WHERE id = ?
    `;

    // Fetch all roles
    const roles = await db.all(getAllRolesQuery);
    for (const role of roles) {
      let permissions;
      try {
        permissions = JSON.parse(role.permissions);
      } catch (e) {
        console.error(`Error parsing permissions for role ${role.id}:`, e);
        continue;
      }

      const index = permissions.indexOf("action:unlike");
      if (index !== -1) {
        permissions[index] = "action:hideQuietly";
        permissions = [...new Set(permissions)];

        await db.run(updateRolePermissionsQuery, JSON.stringify(permissions), role.id);
        console.log(`Updated permissions for role ${role.id}`);
      }
    }
  } catch (err) {
    console.error("Error updating permissions:", err);
  } finally {
    // Close the database
    await db.close();
    console.log("Database connection closed");
  }
}

updatePermissions();
