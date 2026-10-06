const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(process.cwd(), "backend", "src");
const errors = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && fullPath.endsWith(".js")) {
      try {
        execFileSync(process.execPath, ["--check", fullPath], { stdio: "pipe" });
      } catch (error) {
        errors.push({ file: path.relative(process.cwd(), fullPath), output: String(error.stderr || error.stdout || error.message) });
      }
    }
  }
}

walk(root);

if (errors.length) {
  console.error("Backend syntax check gagal:");
  for (const item of errors) {
    console.error("\n[" + item.file + "]\n" + item.output);
  }
  process.exit(1);
}

console.log("Backend syntax check: PASS");
