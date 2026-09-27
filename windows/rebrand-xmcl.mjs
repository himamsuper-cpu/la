import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMoonAssets } from '../scripts/generate-moon-assets.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmclRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the checked-out XMCL source directory.');
const releaseTag = process.argv[3] || 'windows-v2.0.2';
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
const loginForm = path.join(renderer, 'src/components/UserLoginForm.vue');
const homeView = path.join(renderer, 'src/views/Home.vue');
await replaceOnce(
  loginForm,
  `    <UserLoginAuthoritySelect
      v-model="authority"`,
  `    <div class="mb-4 grid grid-cols-3 gap-2" data-testid="quick-login-providers">
      <v-btn
        data-testid="quick-login-microsoft"
        :variant="authority === AUTHORITY_MICROSOFT ? 'flat' : 'tonal'"
        :color="authority === AUTHORITY_MICROSOFT ? 'primary' : undefined"
        @click="chooseQuickAuthority(AUTHORITY_MICROSOFT)"
      >
        <v-icon start size="17">xmcl:microsoft</v-icon>
        Microsoft
      </v-btn>
      <v-btn
        data-testid="quick-login-offline"
        :variant="authority === AUTHORITY_DEV ? 'flat' : 'tonal'"
        :color="authority === AUTHORITY_DEV ? 'primary' : undefined"
        @click="chooseQuickAuthority(AUTHORITY_DEV)"
      >
        <v-icon start size="17">person</v-icon>
        {{ t('userServices.offline.name') }}
      </v-btn>
      <v-btn
        data-testid="quick-login-elyby"
        :variant="authority.includes('ely.by') ? 'flat' : 'tonal'"
        :color="authority.includes('ely.by') ? 'primary' : undefined"
        :loading="isAddingElyBy"
        @click="chooseElyBy"
      >
        <v-icon start size="17">public</v-icon>
        Ely.by
      </v-btn>
    </div>
    <v-alert v-if="quickAuthError" type="warning" density="compact" variant="tonal" class="mb-3">
      {{ quickAuthError }}
    </v-alert>
    <UserLoginAuthoritySelect
      v-model="authority"`,
);
await replaceOnce(
  loginForm,
  'const { login, abortLogin, on } = useService(UserServiceKey)',
  'const { login, abortLogin, on, addYggdrasilService } = useService(UserServiceKey)',
);
await replaceOnce(
  homeView,
  '          <HomeGrid />',
  `          <section class="moon-quick-access mx-3 mb-8 grid gap-5" data-testid="moon-quick-access">
            <div>
              <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold opacity-70">
                <v-icon size="18">explore</v-icon>
                {{ t('store.discover') }}
              </h2>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <v-btn
                  v-for="action in downloadActions"
                  :key="action.id"
                  :data-testid="\`moon-download-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="tonal"
                  color="primary"
                  class="min-h-12 justify-start text-left"
                >
                  <v-icon start>{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
              </div>
            </div>
            <div>
              <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold opacity-70">
                <v-icon size="18">tune</v-icon>
                {{ t('shared.manage') }}
              </h2>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <v-btn
                  v-for="action in manageActions"
                  :key="action.id"
                  :data-testid="\`moon-manage-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="outlined"
                  class="min-h-12 justify-start text-left"
                >
                  <v-icon start>{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
                <v-btn
                  data-testid="moon-import-modpack"
                  block
                  variant="outlined"
                  class="min-h-12 justify-start text-left"
                  :loading="importingModpack"
                  @click="importModpack"
                >
                  <v-icon start>drive_folder_upload</v-icon>
                  {{ t('instance.installModpack') }}
                </v-btn>
              </div>
            </div>
          </section>
          <HomeGrid />`,
);
await rebrandTextFiles(path.join(renderer, 'src'));
await rebrandTextFiles(path.join(renderer, 'locales'));
await replaceOnce(
  homeView,
  `const { show } = useDialog('HomeDropModpackDialog')`,
  `const { show } = useDialog('HomeDropModpackDialog')

const downloadActions = computed(() => [
  { id: 'mods', label: t('modrinth.projectType.mod'), icon: 'extension', to: { path: '/mods', query: { source: 'remote' } } },
  { id: 'modpacks', label: t('modrinth.projectType.modpack'), icon: 'inventory_2', to: '/store' },
  { id: 'resourcepacks', label: t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'remote' } } },
  { id: 'shaders', label: t('modrinth.projectType.shader'), icon: 'flare', to: { path: '/shaderpacks', query: { source: 'remote' } } },
  { id: 'datapacks', label: t('modrinth.projectType.datapack'), icon: 'data_object', to: { path: '/save', query: { source: 'remote', modLoaders: 'datapack' } } },
])

const manageActions = computed(() => [
  { id: 'mods', label: t('shared.manage') + ' ' + t('modrinth.projectType.mod'), icon: 'folder_open', to: { path: '/mods', query: { source: 'local' } } },
  { id: 'resourcepacks', label: t('shared.manage') + ' ' + t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'local' } } },
  { id: 'shaders', label: t('shared.manage') + ' ' + t('modrinth.projectType.shader'), icon: 'tune', to: { path: '/shaderpacks', query: { source: 'local' } } },
  { id: 'worlds', label: t('shared.manage') + ' ' + t('save.name', 2), icon: 'public', to: { path: '/save', query: { source: 'local' } } },
])

const importingModpack = ref(false)
async function importModpack() {
  if (importingModpack.value) return
  importingModpack.value = true
  try {
    const result = await windowController.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
    })
    const file = result.canceled ? undefined : result.filePaths[0]
    if (file) show(file)
  } catch (error) {
    console.error('Failed to select a modpack file', error)
  } finally {
    importingModpack.value = false
  }
}`,
);
await replaceOnce(
  loginForm,
  `watch(authority, () => {
  emit('seed')
})`,
  `watch(authority, () => {
  emit('seed')
})

const ELY_BY_AUTHORITY = 'https://authserver.ely.by/api/yggdrasil'
const isAddingElyBy = ref(false)
const quickAuthError = ref('')

function chooseQuickAuthority(value: string) {
  authority.value = value
  data.username = ''
  data.password = ''
  data.uuid = ''
  quickAuthError.value = ''
  error.value = undefined
  nextTick(() => accountInput.value?.focus())
}

async function chooseElyBy() {
  quickAuthError.value = ''
  const existingElyBy = items.value.find((item) => {
    try {
      return new URL(item.value).hostname === 'authserver.ely.by'
    } catch {
      return false
    }
  })
  if (existingElyBy) {
    chooseQuickAuthority(existingElyBy.value)
    return
  }

  isAddingElyBy.value = true
  try {
    await addYggdrasilService(ELY_BY_AUTHORITY)
    chooseQuickAuthority(ELY_BY_AUTHORITY)
  } catch {
    quickAuthError.value = t('loginError.badNetworkOrServer')
  } finally {
    isAddingElyBy.value = false
  }
}`,
);

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