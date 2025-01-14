#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';

const env = { ...process.env };

(async () => {
  try {
    // Ensure the .next directory exists and is writable
    const nextDir = path.join(process.cwd(), '.next');
    ensureWritableDir(nextDir);

    // If the start command is invoked, ensure the app is built first
    if (process.argv.includes('start')) {
      await exec('npx next build');
    }

    // Execute the requested command
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

  fs.accessSync(dirPath, fs.constants.W_OK);
}

// Execute the command in a child process
function exec(command) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env });
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed with exit code ${code}`));
      }
    });
  });
}
