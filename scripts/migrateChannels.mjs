import fs from "node:fs/promises";
import sqlite3 from "sqlite3";

async function main() {
  await fs.copyFile("./sqlite.db", "./sqlite.db.bak");
  const db = new sqlite3.Database("./sqlite.db.bak");

  db.all("SELECT * FROM ruleset", [], (err, rows) => {
    if (err) {
      throw err;
    }

    rows.forEach((row) => {
      let migratedRow = migrate(row);
      const updatedJson = JSON.stringify(migratedRow);

      // Update each row
      db.run("UPDATE ruleset SET rule = ? WHERE rowid = ?", [updatedJson, row.rowid], (err) => {
        if (err) {
          throw err;
        }
      });
    });
  });

  // Close the database connection
  db.close();
}

function migrate(row) {
  let rules = JSON.parse(row.rule);
  if (row.target === "reply") {
    row.active = false;
  }

  rules.conditions.forEach((condition) => {
    switch (condition.type) {
      case "textMatchesPattern": {
        break;
      }
      case "textMatchesLanguage": {
        break;
      }
      case "containsText": {
        break;
      }
      case "containsTooManyMentions": {
        break;
      }
      case "containsLinks": {
        break;
      }
      case "containsEmbeds": {
        break;
      }
      case "castInThread": {
        break;
      }
      case "castLength": {
        break;
      }
      case "downvote": {
        break;
      }
      case "userProfileContainsText": {
        break;
      }
      case "userDoesNotFollow": {
        break;
      }
      case "userIsCohost": {
        break;
      }
      case "userDisplayNameContainsText": {
        break;
      }
      case "userFollowerCount": {
        break;
      }
      case "userIsNotActive": {
        break;
      }
      case "userDoesNotHoldPowerBadge": {
        break;
      }
      case "userFidInRange": {
        break;
      }
      case "requireActiveHypersub": {
        break;
      }
      case "requiresErc721": {
        break;
      }
      case "requiresErc20": {
        break;
      }
      case "requiresErc1155": {
        break;
      }
    }
  });

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
        // like is by default now, remove the rule
        row.active = false;
        break;
      }
      case "mute": {
        action.type = "ban";
        break;
      }
      case "warnAndHide": {
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
}

/**
 * 
 * action based logic
  14 ban
   5 cooldown
   6 cooldown,hideQuietly
   3 cooldown,warnAndHide
 101 hideQuietly
  36 like
   4 mute
  43 warnAndHide

  if action contains cooldown
    leave it

  if like do nothing
 */

main();
