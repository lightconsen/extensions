/** Shared constants + a tiny YAML-subset parser for entry meta.yaml.
 *
 * meta.yaml is machine-emitted and deliberately restricted: nested maps by
 * indentation, `- ` list items, and scalars that are either bare words or
 * JSON double-quoted strings (JSON strings are valid YAML double-quoted
 * scalars). Anything fancier is rejected — use the emitter, not a real YAML
 * dependency.
 */

export const CATEGORIES = [
  "business",
  "content-writing",
  "data-ai",
  "design",
  "engineering",
  "research-education",
  "security",
  "specialized-domains",
];

/** SPDX identifiers accepted in meta.yaml `license:`. No license = reject. */
export const LICENSES = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "Unlicense",
];

/** ids may contain dots (legacy: dotnet-framework-4.8-expert) but no "..",
 * no leading/trailing punctuation. */
export const ID_RE = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
export function idValid(id) {
  return ID_RE.test(id) && !id.includes("..");
}
export const VERSION_RE = /^\d+\.\d+\.\d+$/;
export const COMMIT_RE = /^[0-9a-f]{7,40}$/;
export const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const CATALOG_BASE_URL = process.env.CATALOG_BASE_URL ?? "https://api.syscity.net";

function scalar(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) return JSON.parse(s);
  return s;
}

/** Parse the restricted meta.yaml subset into a plain object. */
export function parseMeta(text) {
  const lines = text
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  let i = 0;
  function block(indent) {
    const obj = {};
    let arr = null;
    while (i < lines.length) {
      const line = lines[i];
      const cur = line.length - line.trimStart().length;
      if (cur < indent) break;
      if (cur > indent) throw new Error(`unexpected indent: "${line.trim()}"`);
      const t = line.trim();
      if (t.startsWith("- ")) {
        if (arr === null) {
          if (Object.keys(obj).length > 0) throw new Error("mixed list and map at same indent");
          arr = [];
        }
        arr.push(scalar(t.slice(2)));
        i++;
        continue;
      }
      const m = t.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error(`cannot parse line: "${t}"`);
      const key = m[1].trim();
      const rest = m[2].trim();
      i++;
      if (rest === "") {
        const next = i < lines.length ? lines[i].length - lines[i].trimStart().length : -1;
        obj[key] = next > cur ? block(next) : null;
      } else {
        obj[key] = scalar(rest);
      }
    }
    if (arr !== null && Object.keys(obj).length > 0) throw new Error("mixed list and map at same indent");
    return arr ?? obj;
  }
  return block(0);
}

/** URL of a published archive for an entry. */
export function archiveUrl(id, version) {
  return `${CATALOG_BASE_URL}/archives/${id}/${version}/${id}.tar.gz`;
}
