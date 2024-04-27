/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

function generateBulkInsertSql(data: any[], channelId: string, roleId: string): string {
  const values = data
    .map(
      (user) =>
        `('${user.fid}-${channelId}-${roleId}', '${user.fid}', '${user.username}', '${user.pfp_url}', '${channelId}', '${roleId}', NOW(), NOW()`
    )
    .join(", ");

  return `
        INSERT INTO Delegate (id, fid, username, avatarUrl, channelId, roleId, createdAt, updatedAt)
        VALUES ${values};
    `;
}

// Generate the SQL command
const data = JSON.parse(fs.readFileSync("./ciniz-holders.json", "utf-8"));
const sqlQuery = generateBulkInsertSql(data, "wearesoearly", "clvg9ru3t06nzk211dlb31lg0");
console.log(sqlQuery);
