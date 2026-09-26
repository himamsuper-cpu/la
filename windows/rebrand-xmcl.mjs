import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const noomRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmclRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the checked-out XMCL source directory.');

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
        .replaceAll('X Minecraft Launcher', 'Noom Launcher')
        .replaceAll('>XMCL<', '>Noom<')
        .replaceAll('"XMCL"', '"Noom"')
        .replaceAll("'XMCL'", "'Noom'")
        .replaceAll('logo.webp', 'noom-logo.png');
      if (branded !== source) await writeFile(file, branded);
    }
  }
}

const electronApp = path.join(xmclRoot, 'xmcl-electron-app');
const renderer = path.join(xmclRoot, 'xmcl-keystone-ui');
const builderConfig = path.join(electronApp, 'build/electron-builder.config.ts');
await replaceOnce(builderConfig, "productName: 'XMCL',", "productName: 'Noom Launcher',");
await replaceOnce(builderConfig, "appId: 'xmcl',", "appId: 'id.noom.launcher.windows',");
await replaceOnce(builderConfig, "name: 'XMCL',", "name: 'Noom Launcher',");
await replaceOnce(builderConfig, "schemes: ['xmcl'],", "schemes: ['noom'],");
await replaceOnce(builderConfig, `publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],`, 'publish: [],');
await replaceOnce(builderConfig, "artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',", "artifactName: 'Noom-Launcher-${version}-${platform}-${arch}.${ext}',");
await replaceOnce(builderConfig, "icon: 'icons/dark.ico',", "icon: 'icons/noom.ico',");
await replaceOnce(builderConfig, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }],`, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }, {
    from: 'build/Noom-Third-Party-Notices.txt',
    to: 'Noom-Third-Party-Notices.txt',
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
appPackage.version = '1.1.9';
await writeFile(appPackagePath, `${JSON.stringify(appPackage, null, 4)}\n`);

await replaceOnce(
  path.join(renderer, 'src/index.html'),
  '<title>X Minecraft Launcher</title>',
  '<title>Noom Launcher</title>',
);
await rebrandTextFiles(path.join(renderer, 'src'));
await rebrandTextFiles(path.join(renderer, 'locales'));

const noomIcon = path.join(noomRoot, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png');
const rendererAssets = path.join(renderer, 'src/assets');
const electronIcons = path.join(electronApp, 'icons');
await mkdir(rendererAssets, { recursive: true });
await mkdir(electronIcons, { recursive: true });
await copyFile(noomIcon, path.join(rendererAssets, 'noom-logo.png'));

const png = await readFile(noomIcon);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(width >= 256 ? 0 : width, 6);
header.writeUInt8(height >= 256 ? 0 : height, 7);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
await writeFile(path.join(electronIcons, 'noom.ico'), Buffer.concat([header, png]));

const upstreamLicense = await readFile(path.join(xmclRoot, 'LICENSE'), 'utf8');
const notices = await readFile(path.join(noomRoot, 'windows/THIRD_PARTY_NOTICES.md'), 'utf8');
const appBuild = path.join(electronApp, 'build');
await mkdir(appBuild, { recursive: true });
await writeFile(path.join(appBuild, 'Noom-Third-Party-Notices.txt'), `${notices}\n\n${upstreamLicense}`);
await writeFile(
  path.join(electronApp, 'main/pluginAutoUpdate.ts'),
  "import { LauncherAppPlugin } from '@xmcl/runtime/app'\n\nexport const pluginAutoUpdate: LauncherAppPlugin = async () => {}\n",
);

console.log('Prepared Noom Launcher Windows 1.1.9.');