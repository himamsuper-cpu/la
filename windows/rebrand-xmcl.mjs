import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMoonAssets } from '../scripts/generate-moon-assets.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmclRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the checked-out XMCL source directory.');
const releaseTag = process.argv[3] || 'windows-v2.0.0';
const appVersion = releaseTag.replace(/^windows-v/, '');
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error(`Windows releases require a stable version tag: ${releaseTag}`);

async function replaceOnce(file, before, after) {
  const source = await readFile(file, 'utf8');
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`Expected one branding anchor in ${file}: ${before}`);
  }
  await writeFile(file, source.replace(before, after));
}

async function rebrandTextFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rebrandTextFiles(file);
    } else if (/\.(html|json|ts|vue)$/.test(entry.name)) {
      const source = await readFile(file, 'utf8');
      const branded = source
        .replaceAll('X Minecraft Launcher', 'Moon Launcher')
        .replaceAll('>XMCL<', '>Moon<')
        .replaceAll('"XMCL"', '"Moon"')
        .replaceAll("'XMCL'", "'Moon'")
        .replaceAll('logo.webp', 'moon-logo.png');
      if (branded !== source) await writeFile(file, branded);
    }
  }
}

const electronApp = path.join(xmclRoot, 'xmcl-electron-app');
const renderer = path.join(xmclRoot, 'xmcl-keystone-ui');
const builderConfig = path.join(electronApp, 'build/electron-builder.config.ts');
await replaceOnce(builderConfig, "productName: 'XMCL',", "productName: 'Moon Launcher',");
await replaceOnce(builderConfig, "appId: 'xmcl',", "appId: 'id.noom.launcher.windows',");
await replaceOnce(builderConfig, "name: 'XMCL',", "name: 'Moon Launcher',");
await replaceOnce(builderConfig, "schemes: ['xmcl'],", "schemes: ['noom'],");
await replaceOnce(builderConfig, `publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],`, 'publish: [],');
await replaceOnce(builderConfig, "artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',", "artifactName: 'MoonLauncher-v${version}.${ext}',");
await replaceOnce(builderConfig, "icon: 'icons/dark.ico',", "icon: 'icons/moon.ico',");
await replaceOnce(builderConfig, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }],`, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }, {
    from: 'build/Moon-Third-Party-Notices.txt',
    to: 'Moon-Third-Party-Notices.txt',
  }],`);
await replaceOnce(builderConfig, `target: [
      {
        target: 'zip',
        arch: [
          'x64',
          'ia32',
        ],
      },
      'appx',
    ],`, `target: [{
      target: 'nsis',
      arch: ['x64'],
    }],`);

const appPackagePath = path.join(electronApp, 'package.json');
const appPackage = JSON.parse(await readFile(appPackagePath, 'utf8'));
appPackage.version = appVersion;
await writeFile(appPackagePath, `${JSON.stringify(appPackage, null, 4)}\n`);

await replaceOnce(
  path.join(renderer, 'src/index.html'),
  '<title>X Minecraft Launcher</title>',
  '<title>Moon Launcher</title>',
);
await rebrandTextFiles(path.join(renderer, 'src'));
await rebrandTextFiles(path.join(renderer, 'locales'));

const rendererAssets = path.join(renderer, 'src/assets');
const electronIcons = path.join(electronApp, 'icons');
await mkdir(rendererAssets, { recursive: true });
await mkdir(electronIcons, { recursive: true });
await generateMoonAssets(electronIcons);
await copyFile(path.join(electronIcons, 'moon-logo.png'), path.join(rendererAssets, 'moon-logo.png'));

const upstreamLicense = await readFile(path.join(xmclRoot, 'LICENSE'), 'utf8');
const notices = await readFile(path.join(projectRoot, 'windows/THIRD_PARTY_NOTICES.md'), 'utf8');
const appBuild = path.join(electronApp, 'build');
await mkdir(appBuild, { recursive: true });
await writeFile(path.join(appBuild, 'Moon-Third-Party-Notices.txt'), `${notices}\n\n${upstreamLicense}`);
await writeFile(
  path.join(electronApp, 'main/pluginAutoUpdate.ts'),
  "import { LauncherAppPlugin } from '@xmcl/runtime/app'\n\nexport const pluginAutoUpdate: LauncherAppPlugin = async () => {}\n",
);

console.log(`Prepared Moon Launcher Windows ${appVersion}.`);