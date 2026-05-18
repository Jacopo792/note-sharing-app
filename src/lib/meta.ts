import type { Meta } from "./types";
import { EMPTY_META } from "./types";
import type { SessionKeys } from "./crypto";
import { encryptMeta, decryptMeta } from "./crypto";
import { readFile, writeNoteFile } from "./github";

export async function loadMeta(
  repo: string,
  pat: string,
  keys: SessionKeys,
  owner: "u1" | "u2",
): Promise<{ meta: Meta; sha: string | undefined }> {
  const file = await readFile(repo, pat, `notes/meta-${owner}.napp`);
  if (!file) return { meta: { ...EMPTY_META }, sha: undefined };
  const meta = await decryptMeta(file.content, keys);
  return { meta: meta ?? { ...EMPTY_META }, sha: file.sha };
}

export async function saveMeta(
  repo: string,
  pat: string,
  keys: SessionKeys,
  owner: "u1" | "u2",
  meta: Meta,
  sha: string | undefined,
): Promise<string> {
  const content = await encryptMeta(meta, keys, owner);
  return writeNoteFile(repo, pat, `notes/meta-${owner}.napp`, content, sha, "update meta");
}
