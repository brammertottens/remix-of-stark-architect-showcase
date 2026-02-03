# Security Policy

This document outlines the security measures implemented for package integrity verification and supply chain attack prevention.

## Package Integrity Verification

### Overview

This project implements comprehensive package integrity verification to prevent supply chain attacks through:

1. **SHA-512 Integrity Hashes**: All packages in `package-lock.json` include cryptographic hashes
2. **npm Security Configuration**: Strict `.npmrc` settings enforce security best practices
3. **Automated Verification**: Scripts verify package integrity before builds
4. **Security Auditing**: Integration with npm audit for vulnerability scanning

### Security Configuration (.npmrc)

The `.npmrc` file configures npm with security-focused settings:

| Setting | Purpose |
|---------|---------|
| `audit-level=moderate` | Blocks installations with moderate+ vulnerabilities |
| `save-exact=true` | Prevents automatic version updates to potentially compromised versions |
| `package-lock=true` | Ensures package-lock.json is always used |
| `engine-strict=true` | Enforces Node.js version requirements |
| `prefer-offline=true` | Prefers cached packages, reducing network attack surface |
| `strict-ssl=true` | Enforces SSL verification for registry connections |

### Running Security Verification

#### Manual Verification

Run the package verification script:

```bash
node scripts/verify-packages.js
```

This script:
- Verifies all packages have SHA-512 integrity hashes
- Runs npm audit for known vulnerabilities
- Checks npm signature verification support
- Validates .npmrc security configuration

#### Security Audit

Run a comprehensive security audit:

```bash
npm audit
```

For automatic fixes (when safe):

```bash
npm audit fix
```

### Package.json Scripts (Manual Addition Required)

Add these scripts to your `package.json` for integrated security checks:

```json
{
  "scripts": {
    "verify-packages": "node scripts/verify-packages.js",
    "security-audit": "npm audit --audit-level=moderate",
    "security-check": "npm run verify-packages && npm run security-audit",
    "predev": "npm run verify-packages",
    "prebuild": "npm run verify-packages"
  }
}
```

### Regenerating package-lock.json

If you need to regenerate `package-lock.json` with fresh integrity hashes:

```bash
# 1. Delete existing files
rm -rf node_modules package-lock.json

# 2. Reinstall packages (generates new integrity hashes)
npm install

# 3. Verify integrity hashes
node scripts/verify-packages.js

# 4. Commit the updated lockfile
git add package-lock.json
git commit -m "chore: regenerate package-lock.json with integrity hashes"
```

### CI/CD Integration

Add security verification to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Security Check

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Verify package integrity
        run: node scripts/verify-packages.js
      
      - name: Run security audit
        run: npm audit --audit-level=high
```

### Handling Security Failures

#### Integrity Hash Failures

If packages are missing integrity hashes:

1. Regenerate `package-lock.json` as described above
2. If issues persist, check for local or private packages that may not have registry hashes

#### Audit Failures

For vulnerabilities found by npm audit:

1. **Critical/High**: Must be fixed before deployment
   - Run `npm audit fix` for automatic fixes
   - For breaking changes: `npm audit fix --force` (review changes carefully)
   - If no fix available, consider alternative packages

2. **Moderate**: Should be fixed, but may not block deployment
   - Schedule fixes for next release
   - Document accepted risks if deferring

3. **Low/Info**: Address during regular maintenance

### Adding New Packages

Security checklist when adding new packages:

- [ ] Check package popularity and maintenance status on npm
- [ ] Review package dependencies for known vulnerabilities
- [ ] Verify package publisher identity when possible
- [ ] Run `npm audit` after installation
- [ ] Run `node scripts/verify-packages.js` to verify integrity hashes
- [ ] Review package source code for sensitive packages
- [ ] Consider package alternatives with fewer dependencies

### Reporting Security Issues

If you discover a security vulnerability in this project:

1. **Do NOT** open a public issue
2. Email the security concern to the maintainers directly
3. Include steps to reproduce and potential impact
4. Allow reasonable time for a fix before public disclosure

## Additional Resources

- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk Security](https://snyk.io/)
- [Socket.dev](https://socket.dev/) - Supply chain security

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024 | 1.0.0 | Initial security configuration |
