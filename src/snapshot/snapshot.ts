import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  SECRET_PATTERNS,
  TOP_LEVEL_DIRS,
  TOP_LEVEL_FILES,
  VERSION,
} from "../domain/constants.js";
import type { Snapshot, SnapshotFile } from "../domain/types.js";
import { agentDir, posixJoin, safeJoin, toPosix } from "../utils/path-utils.js";

/**
 * Create a snapshot from the local Pi agent configuration.
 */
export async function createSnapshot(): Promise<Snapshot> {
  const files = await collectFiles(agentDir());

  return {
    version: VERSION,
    id: snapshotId(),
    createdAt: new Date().toISOString(),
    machine: os.hostname(),
    files,
  };
}

/**
 * Check whether a relative Pi config path should be excluded from sync.
 *
 * @param relativePath Relative path under the Pi agent config directory.
 */
export function isDeniedPath(relativePath: string): boolean {
  const normalized = toPosix(relativePath);
  const base = path.posix.basename(normalized).toLowerCase();

  return (
    normalized.includes("/node_modules/") ||
    normalized.includes("/.git/") ||
    normalized.includes("/.pisync/") ||
    base === ".env" ||
    base.startsWith(".env.") ||
    base.endsWith(".env") ||
    base.includes("secret") ||
    base.includes("token") ||
    base === "pi-sync.json"
  );
}

/**
 * Scan a snapshot for common secret patterns before allowing upload.
 *
 * @param snapshot Snapshot to inspect.
 */
export function scanSnapshot(snapshot: Snapshot): string[] {
  const findings: string[] = [];

  for (const file of snapshot.files) {
    const content = Buffer.from(file.contentBase64, "base64");

    if (content.includes(0)) {
      continue;
    }

    if (
      SECRET_PATTERNS.some((pattern) => pattern.test(content.toString("utf8")))
    ) {
      findings.push(file.path);
    }
  }

  return findings;
}

/**
 * Write snapshot files into a target directory.
 *
 * @param snapshot Snapshot to write.
 * @param root Target root directory.
 */
export async function materializeSnapshot(
  snapshot: Snapshot,
  root: string,
): Promise<void> {
  await fs.mkdir(root, { recursive: true });

  for (const file of snapshot.files) {
    await materializeFile(root, file);
  }
}

/**
 * Decode base64 snapshot content after validating its shape.
 *
 * @param value Base64 content string.
 * @param filePath File path used in error messages.
 */
export function decodeBase64Strict(value: string, filePath: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error(`Invalid base64 content in snapshot file: ${filePath}`);
  }

  return Buffer.from(value, "base64");
}

/**
 * Hash a buffer with SHA-256.
 *
 * @param value Buffer to hash.
 */
export function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Reduce CRLF (0x0D 0x0A) sequences to LF in a buffer.
 *
 * @param value Buffer to normalize.
 */
function normalizeCrLf(value: Buffer): Buffer {
  const parts: Buffer[] = [];
  let start = 0;

  for (let i = 0; i + 1 < value.length; i += 1) {
    if (value[i] === 0x0d && value[i + 1] === 0x0a) {
      parts.push(value.subarray(start, i));
      start = i + 1;
    }
  }

  if (parts.length === 0) {
    return value;
  }

  parts.push(value.subarray(start));

  return Buffer.concat(parts);
}

/**
 * Hash file content for drift comparison with Windows line endings
 * normalized away.
 *
 * Git's `core.autocrlf=true` (the Git for Windows default) stores CRLF
 * working-tree files as LF blobs, so raw-byte hashes would flag every text
 * file as changed on every push. Text content is hashed with CRLF reduced
 * to LF; binary content (containing a NUL byte) is hashed raw.
 *
 * @param value File content from disk or a Git blob.
 */
export function contentHash(value: Buffer): string {
  return hashBuffer(value.includes(0) ? value : normalizeCrLf(value));
}

/**
 * Hash a snapshot file list by path and hash.
 *
 * @param files Snapshot files to summarize.
 */
export function hashFiles(files: SnapshotFile[]): string {
  return hashBuffer(
    Buffer.from(JSON.stringify(files.map((file) => [file.path, file.sha256]))),
  );
}

/**
 * Convert a snapshot to a path-to-hash map.
 *
 * @param snapshot Snapshot to convert.
 */
export function fileHashMap(snapshot: Snapshot): Record<string, string> {
  return Object.fromEntries(
    snapshot.files.map((file) => [file.path, file.sha256]),
  );
}

async function collectFiles(root: string): Promise<SnapshotFile[]> {
  const results: SnapshotFile[] = [];

  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && TOP_LEVEL_FILES.has(entry.name)) {
      await addFile(results, root, entry.name);
    } else if (entry.isDirectory() && TOP_LEVEL_DIRS.has(entry.name)) {
      await collectDirectory(results, root, entry.name);
    }
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectDirectory(
  results: SnapshotFile[],
  root: string,
  relativeDirectory: string,
): Promise<void> {
  const absoluteDirectory = path.join(root, relativeDirectory);

  for (const entry of await fs.readdir(absoluteDirectory, {
    withFileTypes: true,
  })) {
    const relativePath = posixJoin(relativeDirectory, entry.name);

    if (isDeniedPath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectDirectory(results, root, relativePath);
    } else if (entry.isFile()) {
      await addFile(results, root, relativePath);
    }
  }
}

async function addFile(
  results: SnapshotFile[],
  root: string,
  relativePath: string,
): Promise<void> {
  if (isDeniedPath(relativePath)) {
    return;
  }

  const content = await fs.readFile(safeJoin(root, relativePath));

  results.push({
    path: relativePath,
    contentBase64: content.toString("base64"),
    sha256: contentHash(content),
  });
}

async function materializeFile(
  root: string,
  file: SnapshotFile,
): Promise<void> {
  const target = safeJoin(root, file.path);
  const content = decodeBase64Strict(file.contentBase64, file.path);

  if (contentHash(content) !== file.sha256) {
    throw new Error(`Checksum mismatch in snapshot file: ${file.path}`);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

function snapshotId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}
