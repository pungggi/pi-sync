import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSettingArgs } from "../src/commands/settings.js";

await test("parses string and boolean settings", () => {
  const { updates, errors } = parseSettingArgs([
    "repository=https://github.com/user/repo.git",
    "branch=dev",
    "autoSync=true",
    "secrets=false",
  ]);

  assert.deepEqual(errors, []);
  assert.equal(updates.repository, "https://github.com/user/repo.git");
  assert.equal(updates.branch, "dev");
  assert.equal(updates.autoSync, true);
  assert.equal(updates.secrets, false);
});

await test("coerces common truthy and falsy spellings", () => {
  const { updates, errors } = parseSettingArgs([
    "autoSync=1",
    "secrets=off",
  ]);

  assert.deepEqual(errors, []);
  assert.equal(updates.autoSync, true);
  assert.equal(updates.secrets, false);
});

await test("rejects unknown keys", () => {
  const { updates, errors } = parseSettingArgs(["autopush=true"]);

  assert.deepEqual(updates, {});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Unknown setting: autopush/);
});

await test("rejects arguments without a separator", () => {
  const { updates, errors } = parseSettingArgs(["autoSync"]);

  assert.deepEqual(updates, {});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Expected key=value/);
});

await test("rejects empty values", () => {
  const { updates, errors } = parseSettingArgs(["branch="]);

  assert.deepEqual(updates, {});
  assert.equal(errors.length, 1);
  assert.match(errors[0], /branch must not be empty/);
});
