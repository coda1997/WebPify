import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_PATTERNS = [
  { name: "GitHub token", regex: /\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { name: "AWS access key", regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { name: "Slack token", regex: /\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{10,}\b/g },
  { name: "Private key block", regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----/g },
  {
    name: "Suspicious assignment",
    regex: /\b(?:api[_-]?key|secret|token|password|passwd|access[_-]?key)\b\s*[:=]\s*["'][^"']{8,}["']/gi,
  },
];

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".env",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".xml",
  ".sh",
]);

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  }).trim();

  if (!output) {
    return [];
  }

  return output.split("\n").filter(Boolean);
}

function shouldScanFile(filePath) {
  const lower = filePath.toLowerCase();

  if (lower.startsWith("node_modules/") || lower.startsWith(".next/")) {
    return false;
  }

  if (lower.endsWith(".min.js") || lower.endsWith(".lock")) {
    return false;
  }

  if (lower.includes("pnpm-lock.yaml") || lower.includes("package-lock.json")) {
    return false;
  }

  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex === -1) {
    return true;
  }

  const extension = lower.slice(dotIndex);
  return TEXT_EXTENSIONS.has(extension);
}

function findMatches(filePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (!pattern.regex.test(line)) {
        continue;
      }

      findings.push({
        filePath,
        lineNumber: lineIndex + 1,
        patternName: pattern.name,
        linePreview: line.length > 140 ? `${line.slice(0, 140)}...` : line,
      });
    }
  }

  return findings;
}

function main() {
  const stagedFiles = getStagedFiles();
  const findings = [];

  for (const filePath of stagedFiles) {
    if (!shouldScanFile(filePath)) {
      continue;
    }

    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    findings.push(...findMatches(filePath, content));
  }

  if (findings.length === 0) {
    console.log("✓ Secret scan passed (staged files)");
    return;
  }

  console.error("✗ Potential secrets detected in staged files:");
  for (const finding of findings) {
    console.error(
      `- ${finding.filePath}:${finding.lineNumber} [${finding.patternName}] ${finding.linePreview}`,
    );
  }

  console.error("\nCommit blocked. Remove secrets or rotate credentials before committing.");
  process.exit(1);
}

main();
