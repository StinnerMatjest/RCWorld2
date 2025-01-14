#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const env = { ...process.env };

(async () => {
  try {
    // Ensure the .next directory exists and is writable
    const nextDir = path.join(process.cwd(), '.next');
    ensureWritableDir(nextDir);

    // If running the web server, then prerender pages
    if (process.argv.slice(2).join(' ') === 'npm run start') {
      await exec('npx next build');  // Remove --experimental-build-mode generate
    }
    

    // Launch application
    await exec(process.argv.slice(2).join(' '));
  } catch (err) {
    console.error('Error during entrypoint execution:', err);
    process.exit(1);
  }
})();

// Function to ensure a directory exists and is writable
function ensureWritableDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.access(dirPath, fs.constants.W_OK, (err) => {
    if (err) {
      throw new Error(`Cannot write to ${dirPath}: ${err.message}`);
    }
  });
}

function exec(command) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env });
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed rc=${code}`));
      }
    });
  });
}
