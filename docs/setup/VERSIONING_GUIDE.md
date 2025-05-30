# 🔄 Semantic Versioning Workflow Guide

## 📋 Available Commands

The project now includes a comprehensive semantic versioning workflow with automated release management.

### Version Bump Commands

```bash
# Patch version (1.0.3 → 1.0.4) - Bug fixes
pnpm release:patch

# Minor version (1.0.3 → 1.1.0) - New features
pnpm release:minor

# Major version (1.0.3 → 2.0.0) - Breaking changes
pnpm release:major

# Alpha prerelease (1.0.3 → 1.0.4-alpha.0)
pnpm release:alpha

# Beta prerelease (1.0.3 → 1.0.4-beta.0)
pnpm release:beta

# Release candidate (1.0.3 → 1.0.4-rc.0)
pnpm release:rc
```

### Custom Release Messages

```bash
# With custom commit message
node scripts/version.mjs patch --message="Fix critical authentication bug"

# Prerelease with specific identifier
node scripts/version.mjs prerelease --preid=beta --message="Beta release with new features"
```

## 🚀 Automated Workflow

Each version bump automatically:

1. **🧪 Runs Tests** - Ensures code quality before release
2. **🏗️ Builds Project** - Verifies compilation success
3. **📝 Updates Version** - Increments version in package.json
4. **📋 Updates Changelog** - Adds new version entry with date
5. **📦 Commits Changes** - Creates semantic commit message
6. **🏷️ Creates Git Tag** - Tags the release (e.g., v1.0.3)
7. **⬆️ Pushes to Remote** - Publishes changes and tags

## 📊 Version History Tracking

The CHANGELOG.md file automatically maintains:

- **Version numbers** with semantic versioning
- **Release dates** in ISO format
- **Change categories** (Added, Changed, Fixed, Removed)
- **Unreleased section** for upcoming changes

## 🎯 Best Practices

### When to Use Each Version Type:

- **Patch (x.x.X)** - Bug fixes, security patches, minor improvements
- **Minor (x.X.x)** - New features, API additions (backwards compatible)
- **Major (X.x.x)** - Breaking changes, API removals, architecture changes

### Prerelease Versions:

- **Alpha** - Early development, internal testing
- **Beta** - Feature complete, external testing
- **RC (Release Candidate)** - Production ready, final testing

## 🔧 Configuration

The versioning system is configured in:

- **package.json** - Version scripts and metadata
- **scripts/version.mjs** - Automated versioning logic
- **CHANGELOG.md** - Version history template

## ✅ Current Status

- **Version**: 1.0.3
- **Workflow**: ✅ Fully Automated
- **Testing**: ✅ Integrated
- **Documentation**: ✅ Auto-updated
- **Git Integration**: ✅ Tags and Push
- **Remote Sync**: ✅ Automatic

This versioning system ensures consistent, reliable releases with complete traceability and automated quality checks.
