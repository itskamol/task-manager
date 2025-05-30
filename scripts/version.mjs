#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, '../package.json');
const changelogPath = join(__dirname, '../CHANGELOG.md');

/**
 * @typedef {Object} VersionOptions
 * @property {'major' | 'minor' | 'patch' | 'prerelease'} type
 * @property {string} [message]
 * @property {string} [preId]
 */

class VersionManager {
  /**
   * @param {VersionOptions} options
   */
  static async bump(options) {
    try {
      console.log('🔍 Starting version bump process...');
      
      // Run tests first
      console.log('🧪 Running tests...');
      execSync('pnpm test', { stdio: 'inherit' });
      
      // Build project
      console.log('🏗️  Building project...');
      execSync('pnpm build', { stdio: 'inherit' });
      
      // Version bump
      console.log(`⬆️  Bumping ${options.type} version...`);
      let versionCommand = `pnpm version ${options.type} --no-git-tag-version`;
      if (options.preId && options.type === 'prerelease') {
        versionCommand += ` --preid=${options.preId}`;
      }
      execSync(versionCommand, { stdio: 'inherit' });
      
      // Update changelog
      console.log('📝 Updating changelog...');
      this.updateChangelog(options.message);
      
      // Git operations
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      const version = pkg.version;
      const commitMessage = `chore: release v${version}`;
      
      console.log('📦 Committing changes...');
      execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      
      console.log('🏷️  Creating git tag...');
      execSync(`git tag v${version}`, { stdio: 'inherit' });
      
      console.log('⬆️  Pushing to remote...');
      execSync('git push --follow-tags', { stdio: 'inherit' });
      
      console.log(`✅ Version ${version} released successfully!`);
      console.log(`🎉 Changelog updated, git tagged, and pushed to remote.`);
      
    } catch (error) {
      console.error('❌ Version bump failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * @param {string} [message]
   */
  static updateChangelog(message) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    const version = pkg.version;
    const date = new Date().toISOString().split('T')[0];
    
    let changelog = readFileSync(changelogPath, 'utf8');
    
    // Create new version entry
    const versionEntry = `\n## [${version}] - ${date}\n\n### Changed\n- ${message || 'Version bump with improvements and bug fixes'}\n`;
    
    // Insert after [Unreleased] section
    const unreleasedIndex = changelog.indexOf('## [Unreleased]');
    if (unreleasedIndex !== -1) {
      const nextSectionIndex = changelog.indexOf('\n## [', unreleasedIndex + 1);
      if (nextSectionIndex !== -1) {
        // Insert between Unreleased and next version
        changelog = changelog.slice(0, nextSectionIndex) + versionEntry + changelog.slice(nextSectionIndex);
      } else {
        // Insert at end of file
        changelog += versionEntry;
      }
    } else {
      // No Unreleased section, add at beginning
      changelog = `# Changelog\n\n## [Unreleased]\n${versionEntry}` + changelog;
    }
    
    writeFileSync(changelogPath, changelog);
  }

  /**
   * @returns {Promise<string>}
   */
  static async getCurrentVersion() {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    return pkg.version;
  }

  /**
   * @param {'major' | 'minor' | 'patch'} type
   * @returns {Promise<string>}
   */
  static async getNextVersion(type) {
    const current = await this.getCurrentVersion();
    const [major, minor, patch] = current.split('.').map(Number);
    
    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        throw new Error(`Unknown version type: ${type}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const type = args[0];
  const message = args.find(arg => arg.startsWith('--message='))?.split('=')[1];
  const preId = args.find(arg => arg.startsWith('--preid='))?.split('=')[1];

  if (!type || !['major', 'minor', 'patch', 'prerelease'].includes(type)) {
    console.error('❌ Usage: node scripts/version.mjs <major|minor|patch|prerelease> [--message="Release message"] [--preid=alpha]');
    process.exit(1);
  }

  try {
    const currentVersion = await VersionManager.getCurrentVersion();
    console.log(`📋 Current version: ${currentVersion}`);
    
    if (type !== 'prerelease') {
      const nextVersion = await VersionManager.getNextVersion(type);
      console.log(`🎯 Next version: ${nextVersion}`);
    }

    await VersionManager.bump({ type, message, preId });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { VersionManager };
