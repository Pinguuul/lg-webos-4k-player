const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const app = JSON.parse(fs.readFileSync("app/appinfo.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.strictEqual(
  app.version,
  pkg.version,
  "Package and app versions must match",
);
assert.strictEqual(app.disableBackHistoryAPI, true);
for (const name of ["app.js", "features.js", "config.js"]) {
  new vm.Script(fs.readFileSync(path.join("app", name), "utf8"), {
    filename: name,
  });
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("app/config.js", "utf8"), context);
assert.strictEqual(context.window.LG_PLAYER_CONFIG.serverUrl, "");
assert.strictEqual(context.window.LG_PLAYER_CONFIG.subtitleServer, "");
const html = fs.readFileSync("app/index.html", "utf8");
assert(html.includes('lang="en"'));
for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
  assert(
    fs.existsSync(path.join("app", match[1])),
    `Missing script ${match[1]}`,
  );
}
for (const name of [app.main, app.icon, app.largeIcon]) {
  assert(fs.existsSync(path.join("app", name)), `Missing app asset ${name}`);
}
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.deepStrictEqual(scripts, ["config.js", "features.js", "app.js"]);
console.log(
  "App metadata, script syntax, generic defaults and required assets: OK",
);
