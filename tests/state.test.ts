import assert from "node:assert/strict";
import { test } from "node:test";

import type { Snapshot, SnapshotFile, SyncState } from "../src/domain/types.js";
import { remoteChangedSinceState } from "../src/state/state.js";

const FILE_A: SnapshotFile = {
  path: "settings.json",
  contentBase64: "e30=",
  sha256: "hash-a",
};

const FILE_B: SnapshotFile = {
  path: "settings.json",
  contentBase64: "e30=",
  sha256: "hash-b",
};

function snapshot(id: string, files: SnapshotFile[]): Snapshot {
  return {
    version: 1,
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    machine: "test",
    files,
  };
}

function syncState(
  lastFileHashes: Record<string, string>,
  lastAppliedSnapshot?: string,
): SyncState {
  return { version: 1, lastAppliedSnapshot, lastFileHashes };
}

await test("remote commit moved but content identical does not count as changed", () => {
  const state = syncState({ "settings.json": "hash-a" }, "abc1234");

  assert.equal(
    remoteChangedSinceState(snapshot("def5678", [FILE_A]), state),
    false,
  );
});

await test("remote at last synced commit is unchanged", () => {
  const state = syncState({ "settings.json": "hash-a" }, "abc1234");

  assert.equal(
    remoteChangedSinceState(snapshot("abc1234", [FILE_A]), state),
    false,
  );
});

await test("remote with different content counts as changed", () => {
  const state = syncState({ "settings.json": "hash-a" }, "abc1234");

  assert.equal(
    remoteChangedSinceState(snapshot("def5678", [FILE_B]), state),
    true,
  );
});

await test("remote that dropped files counts as changed", () => {
  const state = syncState(
    { "settings.json": "hash-a", "themes/dark.json": "hash-t" },
    "abc1234",
  );

  assert.equal(
    remoteChangedSinceState(snapshot("def5678", [FILE_A]), state),
    true,
  );
});

await test("missing remote counts as changed only after a first sync", () => {
  assert.equal(
    remoteChangedSinceState(
      undefined,
      syncState({ "settings.json": "hash-a" }, "abc1234"),
    ),
    true,
  );
  assert.equal(remoteChangedSinceState(undefined, syncState({})), false);
});

await test("remote on a fresh machine counts as changed", () => {
  assert.equal(
    remoteChangedSinceState(snapshot("def5678", [FILE_A]), syncState({})),
    true,
  );
});
