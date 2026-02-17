#!/usr/bin/env node

/**
 * Selective Script Execution for Trusted Packages
 *
 * Reads trusted-packages.json and runs `npm rebuild` only for
 * packages explicitly listed, after verify-packages.js has passed.
 *
 * Usage:  node scripts/run-trusted-scripts.js
 * Exit 0 = success, 1 = failure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(msg, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function loadTrustedPackages() {
  const configPath = path.join(process.cwd(), 'trusted-packages.json');
  if (!fs.existsSync(configPath)) {
    log('✗ trusted-packages.json not found', COLORS.red);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config.packages || [];
}

function getInstalledPackages() {
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    // Also check bun.lockb existence – if only bun lockfile exists, warn
    const bunLock = path.join(process.cwd(), 'bun.lockb');
    if (fs.existsSync(bunLock)) {
      log('⚠ Only bun.lockb found. Trusted-script rebuild uses npm rebuild; ensure package-lock.json is present for full verification.', COLORS.yellow);
    }
    return [];
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  return Object.keys(lock.packages || {}).filter(k => k !== '');
}

function matchesTrusted(pkgPath, trustedList) {
  const pkgName = pkgPath.replace(/^node_modules\//, '');
  return trustedList.some(t => pkgName === t.name || pkgName.startsWith(t.name + '/'));
}

function main() {
  log('\n🔐 Selective Script Execution for Trusted Packages', COLORS.cyan);
  log('===================================================\n', COLORS.cyan);

  const trusted = loadTrustedPackages();
  log(`Trusted packages configured: ${trusted.length}`);
  trusted.forEach(t => log(`  • ${t.name} — ${t.reason}`, COLORS.green));

  const installed = getInstalledPackages();
  const toRebuild = [];

  for (const pkgPath of installed) {
    if (matchesTrusted(pkgPath, trusted)) {
      toRebuild.push(pkgPath.replace(/^node_modules\//, ''));
    }
  }

  if (toRebuild.length === 0) {
    log('\nNo trusted packages require rebuild.', COLORS.green);
    process.exit(0);
  }

  log(`\nRebuilding ${toRebuild.length} trusted package(s)...`, COLORS.cyan);

  for (const pkg of toRebuild) {
    try {
      log(`  Rebuilding: ${pkg}`, COLORS.yellow);
      execSync(`npm rebuild ${pkg}`, { stdio: 'inherit', timeout: 60000 });
      log(`  ✓ ${pkg} rebuilt successfully`, COLORS.green);
    } catch (err) {
      log(`  ✗ Failed to rebuild ${pkg}: ${err.message}`, COLORS.red);
      process.exit(1);
    }
  }

  log('\n✓ All trusted package scripts executed successfully', COLORS.green);
  process.exit(0);
}

main();
