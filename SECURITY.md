# Security Policy

This document outlines the security measures implemented for package integrity verification and supply chain attack prevention.

> **Runtime note:** This project uses **Bun** as its JavaScript runtime. npm-compatible configuration files (`.npmrc`, `package-lock.json`) are maintained for security tooling compatibility (e.g., `npm audit`).

## Quick Start

```bash
# 1. Install dependencies (scripts are blocked by .npmrc ignore-scripts=true)
bun install

# 2. Verify package integrity & run security audit
node scripts/verify-packages.js

# 3. Rebuild only trusted packages (selective script execution)
node scripts/run-trusted-scripts.js

# 4. Start development
bun run dev
```

## Architecture Overview

```
.npmrc                        ← Blocks all install scripts by default
trusted-packages.json         ← Whitelist of packages allowed to run scripts
scripts/verify-packages.js    ← Integrity hashes, audit, .npmrc, trusted config checks
scripts/run-trusted-scripts.js ← Selectively rebuilds only trusted packages
```

### Security Flow

1. **Install** — `bun install` (or `npm ci --ignore-scripts`) installs packages with all scripts blocked.
2. **Verify** — `verify-packages.js` checks integrity hashes, runs `npm audit`, validates `.npmrc` and `trusted-packages.json`.
3. **Rebuild trusted** — `run-trusted-scripts.js` runs `npm rebuild` only for packages listed in `trusted-packages.json`.

## Package Integrity Verification

### What verify-packages.js checks

| Check | Description |
|-------|-------------|
| **Integrity hashes** | All packages in `package-lock.json` have SHA-512 hashes |
| **Security audit** | No critical/high vulnerabilities via `npm audit` |
| **Signature support** | npm version supports package signature verification |
| **.npmrc config** | Required security settings are present (`ignore-scripts`, `strict-ssl`, etc.) |
| **Trusted packages** | `trusted-packages.json` is valid and entries are complete |

### Running verification

```bash
node scripts/verify-packages.js
```

## .npmrc Security Configuration

| Setting | Purpose |
|---------|---------|
| `ignore-scripts=true` | **Blocks all package install scripts** — core security control |
| `audit=true` | Enables security audits during installation |
| `audit-level=moderate` | Blocks installations with moderate+ vulnerabilities |
| `save-exact=true` | Prevents automatic version updates to compromised versions |
| `package-lock=true` | Ensures package-lock.json is always used |
| `engine-strict=true` | Enforces Node.js version requirements |
| `prefer-offline=true` | Prefers cached packages, reducing network attack surface |
| `optional=false` | Prevents optional dependencies from installing automatically |
| `strict-ssl=true` | Enforces SSL verification for registry connections |

## Trusted Packages

Only packages listed in `trusted-packages.json` are allowed to execute scripts after verification. The file structure:

```json
{
  "lastReviewed": "2025-02-17",
  "reviewCadence": "quarterly",
  "packages": [
    {
      "name": "esbuild",
      "reason": "Requires post-install script to download platform-specific binary",
      "lastReviewed": "2025-02-17"
    }
  ]
}
```

### Adding a trusted package

1. Verify the package genuinely requires install scripts
2. Review what scripts the package executes
3. Add an entry to `trusted-packages.json` with a clear justification
4. Update `lastReviewed` date
5. Commit and request security review

### Quarterly review

Every 90 days, review all trusted packages:
- Is the package still needed?
- Are the scripts still required?
- Has the package changed ownership or maintainers?
- Update `lastReviewed` dates

## GitHub-Side Configuration (Manual Steps)

The following must be configured directly in your GitHub repository:

### 1. package.json scripts

Add these scripts to `package.json` via GitHub:

```json
{
  "scripts": {
    "verify-packages": "node scripts/verify-packages.js",
    "run-trusted-scripts": "node scripts/run-trusted-scripts.js",
    "security-check": "node scripts/verify-packages.js && node scripts/run-trusted-scripts.js",
    "security-audit": "npm audit --audit-level=moderate",
    "predev": "node scripts/verify-packages.js",
    "prebuild": "node scripts/verify-packages.js"
  }
}
```

### 2. CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/security.yml`:

```yaml
name: Security Check

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies (scripts blocked)
        run: bun install

      - name: Verify package integrity
        run: node scripts/verify-packages.js

      - name: Run trusted package scripts
        run: node scripts/run-trusted-scripts.js

      - name: Run security audit
        run: npm audit --audit-level=high
```

## Regenerating package-lock.json

```bash
# 1. Delete existing lockfile
rm -rf node_modules package-lock.json

# 2. Reinstall (generates fresh integrity hashes; scripts remain blocked)
bun install

# 3. Verify
node scripts/verify-packages.js

# 4. Commit
git add package-lock.json
git commit -m "chore: regenerate package-lock.json with integrity hashes"
```

## Handling Failures

### Integrity hash failures

1. Regenerate `package-lock.json` as above
2. If issues persist, check for local/private packages without registry hashes

### Audit failures

| Severity | Action |
|----------|--------|
| **Critical/High** | Must fix before deployment — `npm audit fix` |
| **Moderate** | Schedule for next release; document accepted risk |
| **Low/Info** | Address during regular maintenance |

### Trusted script failures

1. Check the package is listed in `trusted-packages.json`
2. Verify the package version matches what's installed
3. Check `npm rebuild <package>` works manually

## Adding New Dependencies

Security checklist:

- [ ] Check package popularity and maintenance on npm
- [ ] Review dependencies for known vulnerabilities
- [ ] Verify publisher identity
- [ ] Run `npm audit` after installation
- [ ] Run `node scripts/verify-packages.js`
- [ ] If package needs install scripts, add to `trusted-packages.json` with justification
- [ ] Review package source for sensitive packages

## Reporting Security Issues

1. **Do NOT** open a public issue
2. Email security concerns to maintainers directly
3. Include reproduction steps and potential impact
4. Allow reasonable time for a fix before public disclosure

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024 | 1.0.0 | Initial security configuration |
| 2025 | 2.0.0 | Added ignore-scripts enforcement, trusted packages, Bun runtime docs |
