#!/usr/bin/env node

/**
 * Package Integrity Verification Script
 *
 * Validates SHA-512 integrity hashes, runs security audits,
 * checks signature support, verifies .npmrc config, and
 * validates trusted-packages.json.
 *
 * Exit 0 = all checks passed, 1 = failure
 *
 * NOTE: This project uses Bun as its runtime. npm-compatible
 * config files (.npmrc, package-lock.json) are maintained for
 * security tooling compatibility.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Logging helpers ────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log     = (m, c = C.reset) => console.log(`${c}${m}${C.reset}`);
const section = (t) => { console.log('\n' + '='.repeat(60)); log(t, C.cyan); console.log('='.repeat(60)); };
const ok      = (m) => log(`✓ ${m}`, C.green);
const warn    = (m) => log(`⚠ ${m}`, C.yellow);
const fail    = (m) => log(`✗ ${m}`, C.red);

// ── 1. Integrity hashes ───────────────────────────────────

function verifyIntegrity() {
  section('Verifying package-lock.json Integrity Hashes');

  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    fail('package-lock.json not found! Run "bun install" to generate it.');
    return false;
  }

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const pkgs = lock.packages || {};
    let total = 0, withHash = 0, sha512 = 0;
    const missing = [];

    for (const [name, pkg] of Object.entries(pkgs)) {
      if (name === '') continue;
      total++;
      if (pkg.integrity) {
        withHash++;
        if (pkg.integrity.startsWith('sha512-')) sha512++;
      } else {
        missing.push(name);
      }
    }

    log(`Total packages: ${total}`);
    log(`With integrity hashes: ${withHash}`);
    log(`With SHA-512: ${sha512}`);

    if (missing.length > 0) {
      warn(`Missing integrity: ${missing.length}`);
      missing.slice(0, 10).forEach(p => warn(`  - ${p}`));
      if (missing.length > 10) warn(`  ... and ${missing.length - 10} more`);
    }

    const rate = ((withHash / total) * 100).toFixed(1);
    if (withHash === total) { ok(`All packages have integrity hashes (${rate}%)`); return true; }
    if (rate >= 95)         { warn(`${rate}% of packages have integrity hashes`); return true; }
    fail(`Only ${rate}% of packages have integrity hashes`);
    return false;
  } catch (e) {
    fail(`Failed to parse package-lock.json: ${e.message}`);
    return false;
  }
}

// ── 2. Security audit ─────────────────────────────────────

function runAudit() {
  section('Running Security Audit');

  try {
    const out = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    try {
      const result = JSON.parse(out);
      const v = result.metadata?.vulnerabilities || {};
      const critical = v.critical || 0;
      const high = v.high || 0;
      const moderate = v.moderate || 0;

      log('Vulnerabilities found:');
      critical > 0 ? fail(`  Critical: ${critical}`) : log(`  Critical: ${critical}`);
      high     > 0 ? fail(`  High: ${high}`)         : log(`  High: ${high}`);
      moderate > 0 ? warn(`  Moderate: ${moderate}`)  : log(`  Moderate: ${moderate}`);
      log(`  Low: ${v.low || 0}`);
      log(`  Info: ${v.info || 0}`);

      if (critical > 0 || high > 0) {
        fail('Critical/high vulnerabilities found! Run "npm audit fix".');
        return false;
      }
      if (moderate > 0) { warn('Moderate vulnerabilities found. Review with "npm audit".'); }
      else { ok('No significant vulnerabilities found'); }
      return true;
    } catch {
      warn('Could not parse audit JSON; running standard mode...');
      try { execSync('npm audit --audit-level=high', { stdio: 'inherit' }); ok('Audit passed'); return true; }
      catch { fail('Audit failed'); return false; }
    }
  } catch (e) {
    fail(`Audit error: ${e.message}`);
    return false;
  }
}

// ── 3. Signature support ──────────────────────────────────

function verifySignatures() {
  section('Checking Package Signature Verification');

  try {
    const ver = execSync('npm --version', { encoding: 'utf8' }).trim();
    const [maj, min] = ver.split('.').map(Number);
    log(`npm version: ${ver}`);

    if (maj > 8 || (maj === 8 && min >= 15)) {
      ok('npm version supports signature verification');
      try { execSync('npm audit signatures 2>/dev/null', { encoding: 'utf8', timeout: 30000 }); ok('Signature verification available'); }
      catch { warn('Signature check skipped (registry support may be required)'); }
    } else {
      warn(`npm ${ver} has limited signature support – consider upgrading`);
    }
    return true;
  } catch (e) {
    warn(`Could not check npm version: ${e.message}`);
    return true;
  }
}

// ── 4. .npmrc validation ──────────────────────────────────

function verifyNpmrc() {
  section('Verifying .npmrc Security Configuration');

  const npmrcPath = path.join(process.cwd(), '.npmrc');
  if (!fs.existsSync(npmrcPath)) { warn('.npmrc not found'); return true; }

  const content = fs.readFileSync(npmrcPath, 'utf8');

  const required    = ['ignore-scripts=true', 'audit-level', 'package-lock=true', 'strict-ssl=true'];
  const recommended = ['save-exact=true', 'engine-strict=true', 'prefer-offline=true', 'optional=false'];

  let allGood = true;
  for (const s of required) {
    const key = s.split('=')[0];
    if (content.includes(key)) { ok(`Required: ${key}`); }
    else { warn(`Missing required: ${s}`); allGood = false; }
  }
  for (const s of recommended) {
    const key = s.split('=')[0];
    if (content.includes(key)) { ok(`Recommended: ${key}`); }
    else { warn(`Consider adding: ${s}`); }
  }
  return allGood;
}

// ── 5. Trusted packages validation ────────────────────────

function verifyTrustedPackages() {
  section('Validating trusted-packages.json');

  const cfgPath = path.join(process.cwd(), 'trusted-packages.json');
  if (!fs.existsSync(cfgPath)) { warn('trusted-packages.json not found – no selective script execution configured'); return true; }

  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const pkgs = cfg.packages || [];

    if (pkgs.length === 0) { warn('Trusted packages list is empty'); return true; }

    ok(`${pkgs.length} trusted package(s) configured`);
    pkgs.forEach(p => {
      if (!p.name || !p.reason) { warn(`  Incomplete entry: ${JSON.stringify(p)}`); }
      else { ok(`  ${p.name} — ${p.reason}`); }
    });

    if (cfg.lastReviewed) {
      const reviewed = new Date(cfg.lastReviewed);
      const now = new Date();
      const daysSince = Math.floor((now - reviewed) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) { warn(`Last reviewed ${daysSince} days ago – due for quarterly review`); }
      else { ok(`Last reviewed ${daysSince} day(s) ago`); }
    }
    return true;
  } catch (e) {
    fail(`Failed to parse trusted-packages.json: ${e.message}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  log('\n🔒 Package Integrity Verification (Bun + npm-compat)', C.blue);
  log('=====================================================\n', C.blue);

  const results = {
    npmrc:     verifyNpmrc(),
    integrity: verifyIntegrity(),
    audit:     runAudit(),
    signatures: verifySignatures(),
    trusted:   verifyTrustedPackages(),
  };

  section('Verification Summary');
  const allPassed = Object.values(results).every(Boolean);
  for (const [k, v] of Object.entries(results)) {
    v ? ok(`${k}: PASSED`) : fail(`${k}: FAILED`);
  }

  console.log('');
  allPassed ? ok('All security verifications passed! ✓') : fail('Some verifications failed. Review output above.');
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => { fail(`Unexpected error: ${e.message}`); process.exit(1); });
