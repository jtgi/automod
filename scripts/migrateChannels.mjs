import fs from "node:fs/promises";
import sqlite3 from "sqlite3";

async function main() {
  const changeExplanations = {};

  await fs.copyFile("./sqlite.db", "./sqlite.db.bak");
  const db = new sqlite3.Database("./sqlite.db.bak");

  db.all("SELECT * FROM ruleset", [], (err, rows) => {
    if (err) {
      throw err;
    }

    rows.forEach((row) => {
      let migratedRow = migrate(row, changeExplanations);

      console.log(changeExplanations);

      const updatedRule = migratedRow.rule;
      const updatedActions = migratedRow.actions;
      const updatedActive = migratedRow.active;

      // Update each row
      db.run(
        "UPDATE ruleset SET rule = ?, actions = ?, active = ? WHERE id = ?",
        [updatedRule, updatedActions, updatedActive, row.id],
        (err) => {
          if (err) {
            throw err;
          }
        }
      );
    });
  });

  // Close the database connection
  db.close();
}

function migrate(currentRow, changeExplanations) {
  function addExplanation(channelId, explanation) {
    changeExplanations[channelId] = changeExplanations[channelId] || [];
    changeExplanations[channelId].push(explanation);
  }

  const row = structuredClone(currentRow);
  if (row.target === "reply") {
    row.active = false;
    addExplanation(
      row.channelId,
      `Rule was targeted for replies which can no longer be moderated in the new channel design. It has been disabled`
    );
  }

  let actions = JSON.parse(row.actions || "[]");
  actions.forEach((action) => {
    switch (action.type) {
      case "bypass": {
        break;
      }
      case "addToBypass": {
        break;
      }
      case "hideQuietly": {
        break;
      }
      case "downvote": {
        break;
      }
      case "ban": {
        break;
      }
      case "like": {
        addExplanation(
          row.channelId,
          `Rule had a "Boost" action but with the Trending tab disappearing the concept of "Boost" has changed. By default, anything that is not caught by your rules will be "Boosted" and shown in the "Main" feed. As a result, this rule is no longer needed and has been disabled.`
        );
        row.active = false;
        break;
      }
      case "mute": {
        addExplanation(
          row.channelId,
          `Rule used a "Mute" action but Mute is no longer needed. Mute was created because Warpcast did not have the ability to unban, but now you can since bans are managed entirely by you inside automod. Mute has been renamed to "Ban". The action was updated.`
        );
        action.type = "ban";
        break;
      }
      case "warnAndHide": {
        addExplanation(
          row.channelId,
          `Rule used a "Warn & Hide" but warning is no longer supported. It has been converted to "Hide".`
        );
        action.type = "hideQuietly";
        break;
      }
      case "cooldown": {
        break;
      }
      case "cooldownEnded": {
        break;
      }
      case "unhide": {
        break;
      }
      case "unmuted": {
        break;
      }
      case "grantRole": {
        break;
      }
    }
  });

  return row;
}

main();
