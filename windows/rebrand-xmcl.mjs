import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMoonAssets } from '../scripts/generate-moon-assets.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmclRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the checked-out XMCL source directory.');
const releaseTag = process.argv[3] || 'windows-v2.1.0-beta.4';
const appVersion = releaseTag.replace(/^windows-v/, '');
if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(appVersion)) throw new Error(`Invalid Windows release tag: ${releaseTag}`);

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
const uiPackagePath = path.join(renderer, 'package.json');
const uiPackage = JSON.parse(await readFile(uiPackagePath, 'utf8'));
uiPackage.dependencies['livekit-client'] = '2.22.3';
await writeFile(uiPackagePath, `${JSON.stringify(uiPackage, null, 4)}\n`);
await copyFile(
  path.join(projectRoot, 'windows/MoonVoiceRoom.vue'),
  path.join(renderer, 'src/views/MoonVoiceRoom.vue'),
);
await replaceOnce(builderConfig, "productName: 'XMCL',", "productName: 'Moon Launcher',");
await replaceOnce(builderConfig, "appId: 'xmcl',", "appId: 'id.noom.launcher.windows',");
await replaceOnce(builderConfig, "name: 'XMCL',", "name: 'Moon Launcher',");
await replaceOnce(builderConfig, "schemes: ['xmcl'],", "schemes: ['noom'],");
await replaceOnce(builderConfig, `publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],`, 'publish: [],');
await replaceOnce(builderConfig, "artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',", "artifactName: 'MoonLauncher-v${version}-${arch}.${ext}',");
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
await replaceOnce(
  path.join(renderer, 'src/index.html'),
  '<title>Moon Launcher</title>',
  '<title>Moon Launcher</title>\n    <link rel="icon" type="image/png" href="./assets/moon-logo.png">',
);
const loginForm = path.join(renderer, 'src/components/UserLoginForm.vue');
const homeView = path.join(renderer, 'src/views/Home.vue');
const sidebarView = path.join(renderer, 'src/views/AppSideBarClassic.vue');
const vuetifyConfig = path.join(renderer, 'src/vuetify.ts');
await replaceOnce(
  vuetifyConfig,
  "primary: '#4caf50',\n          accent: '#00e676',",
  "primary: '#79cba4',\n          accent: '#f2b56b',",
);
await replaceOnce(
  homeView,
  "import HomeCriticalError from './HomeCriticalError.vue'",
  "import MoonVoiceRoom from './MoonVoiceRoom.vue'\nimport moonLogo from '@/assets/moon-logo.png'\nimport moonHero from '@/assets/moon-hero.webp'\nimport HomeCriticalError from './HomeCriticalError.vue'",
);
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
  `          <section class="moon-hero mx-3 mb-6" data-testid="moon-hero">
            <img class="moon-hero__art" :src="moonHero" alt="" />
            <div class="moon-hero__content">
              <div class="moon-hero__brandline">
                <img class="moon-hero__logo" :src="moonLogo" alt="" />
                <div>
                  <div class="moon-hero__wordmark">MOON LAUNCHER</div>
                  <div class="moon-hero__caption">MINECRAFT JAVA EDITION</div>
                </div>
              </div>
              <div class="moon-hero__eyebrow"><v-icon size="15">nightlight</v-icon> YOUR WORLD, READY TO PLAY</div>
              <h1>{{ instance.name || ('Minecraft ' + instance.runtime.minecraft) }}</h1>
              <div class="moon-hero__status">
                <span class="moon-hero__status-dot" />
                <span>{{ instance.runtime.minecraft || 'Minecraft Java' }}</span>
                <span class="moon-hero__separator">/</span>
                <span>{{ t('instance.name', 1) }}</span>
              </div>
              <v-btn data-testid="moon-play" color="primary" size="large" variant="flat" class="moon-hero__play mt-5" @click="onLaunchClick()">
                <v-icon start>play_arrow</v-icon>
                {{ launchText }}
              </v-btn>
            </div>
          </section>
          <section class="moon-quick-access mx-3 mb-8 grid gap-4" data-testid="moon-quick-access">
            <div class="moon-quick-access__group">
              <h2 class="moon-quick-access__heading">
                <span class="moon-quick-access__index">01</span>
                <v-icon class="moon-section-icon" size="18">explore</v-icon>
                {{ t('store.discover') }}
              </h2>
              <div class="moon-quick-access__grid">
                <v-btn
                  v-for="action in downloadActions"
                  :key="action.id"
                  :data-testid="\`moon-download-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="tonal"
                  color="primary"
                  class="moon-action-button min-h-12 justify-start text-left"
                >
                  <v-icon start class="moon-action-button__icon">{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
              </div>
            </div>
            <div class="moon-quick-access__group">
              <h2 class="moon-quick-access__heading">
                <span class="moon-quick-access__index">02</span>
                <v-icon class="moon-section-icon" size="18">tune</v-icon>
                {{ t('shared.manage') }}
              </h2>
              <div class="moon-quick-access__grid">
                <v-btn
                  v-for="action in manageActions"
                  :key="action.id"
                  :data-testid="\`moon-manage-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="outlined"
                  class="moon-action-button min-h-12 justify-start text-left"
                >
                  <v-icon start class="moon-action-button__icon">{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
                <v-btn
                  data-testid="moon-import-modpack"
                  block
                  variant="outlined"
                  class="moon-action-button min-h-12 justify-start text-left"
                  :loading="importingModpack"
                  @click="importModpack"
                >
                  <v-icon start class="moon-action-button__icon">drive_folder_upload</v-icon>
                  {{ t('instance.installModpack') }}
                </v-btn>
              </div>
            </div>
          </section>
          <section class="mx-3 mb-6" data-testid="moon-voice-room">
            <MoonVoiceRoom />
          </section>
          <HomeGrid />`,
);
await rebrandTextFiles(path.join(renderer, 'src'));
await rebrandTextFiles(path.join(renderer, 'locales'));
await replaceOnce(
  sidebarView,
  "import PlayerAvatar from '@/components/PlayerAvatar.vue'",
  "import moonLogo from '@/assets/moon-logo.png'\nimport PlayerAvatar from '@/components/PlayerAvatar.vue'",
);
await replaceOnce(
  sidebarView,
  `    <div v-roving-tabindex role="group" class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"`,
  `    <div class="moon-sidebar-brand" aria-label="Moon Launcher">
      <img :src="moonLogo" alt="" />
      <span>MOON</span>
    </div>
    <div v-roving-tabindex role="group" class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"`,
);
await replaceOnce(
  sidebarView,
  `    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <v-btn
        v-shared-tooltip.bottom="t('shared.back')"`,
  `    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <div class="moon-sidebar-brand moon-sidebar-brand--horizontal" aria-label="Moon Launcher">
        <img :src="moonLogo" alt="" />
        <span>MOON</span>
      </div>
      <v-btn
        v-shared-tooltip.bottom="t('shared.back')"`,
);
await replaceOnce(
  sidebarView,
  '</style>',
  `.moon-sidebar-brand {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 3px auto 10px;
  color: rgba(var(--v-theme-on-surface), 0.82);
  font-size: 9px;
  font-weight: 800;
}

.moon-sidebar-brand img {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 9px;
}

.moon-sidebar-brand--horizontal {
  flex-direction: row;
  gap: 7px;
  margin: 0 8px 0 2px;
  font-size: 10px;
}

.moon-sidebar-brand--horizontal img {
  width: 28px;
  height: 28px;
}
</style>`,
);
await replaceOnce(
  sidebarView,
  `    <div
      ref="instancesScrollEl"`,
  `    <div v-roving-tabindex role="group" class="sidebar__section sidebar__quick-links">
      <AppSideBarItem
        v-for="action in marketShortcuts"
        :key="action.id"
        :data-testid="\`nav-content-\${action.id}\`"
        v-shared-tooltip.right="() => action.label"
        :to="action.to"
        :aria-label="action.label"
      >
        <v-icon class="sidebar-item__icon" :size="22">{{ action.icon }}</v-icon>
      </AppSideBarItem>
    </div>

    <div class="sidebar__divider" />

    <div
      ref="instancesScrollEl"`,
);
await replaceOnce(
  sidebarView,
  `      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative"`,
  `      <v-menu location="bottom start">
        <template #activator="{ props: marketMenuProps }">
          <v-btn
            v-bind="marketMenuProps"
            data-testid="nav-content-menu"
            v-shared-tooltip.bottom="t('store.discover')"
            icon
            :aria-label="t('store.discover')"
            class="non-moveable mr-1"
          >
            <v-icon>apps</v-icon>
          </v-btn>
        </template>
        <v-list density="compact" min-width="230">
          <v-list-item
            v-for="action in marketShortcuts"
            :key="action.id"
            :data-testid="\`nav-content-\${action.id}\`"
            :to="action.to"
            :title="action.label"
          >
            <template #prepend><v-icon>{{ action.icon }}</v-icon></template>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative"`,
);
await replaceOnce(
  homeView,
  `const { show } = useDialog('HomeDropModpackDialog')`,
  `const { show } = useDialog('HomeDropModpackDialog')

const downloadActions = computed(() => [
  { id: 'mods', label: t('modrinth.projectType.mod'), icon: 'extension', to: { path: '/mods', query: { source: 'remote' } } },
  { id: 'modpacks', label: t('modrinth.projectType.modpack'), icon: 'inventory_2', to: '/store' },
  { id: 'resourcepacks', label: t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'remote' } } },
  { id: 'shaders', label: t('modrinth.projectType.shader'), icon: 'flare', to: { path: '/shaderpacks', query: { source: 'remote' } } },
  { id: 'datapacks', label: t('modrinth.projectType.datapack'), icon: 'data_object', to: { path: '/save', query: { source: 'remote', modrinthCategories: 'datapack' } } },
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
  sidebarView,
  `const settingsAriaLabel = computed(() => t('setting.name', 2))`,
  `const settingsAriaLabel = computed(() => t('setting.name', 2))
const marketShortcuts = computed(() => [
  { id: 'mods', label: t('modrinth.projectType.mod'), icon: 'extension', to: { path: '/mods', query: { source: 'remote' } } },
  { id: 'modpacks', label: t('modrinth.projectType.modpack'), icon: 'inventory_2', to: '/store' },
  { id: 'resourcepacks', label: t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'remote' } } },
  { id: 'shaders', label: t('modrinth.projectType.shader'), icon: 'flare', to: { path: '/shaderpacks', query: { source: 'remote' } } },
  { id: 'datapacks', label: t('modrinth.projectType.datapack'), icon: 'data_object', to: { path: '/save', query: { source: 'remote', modrinthCategories: 'datapack' } } },
])`,
);
await replaceOnce(
  homeView,
  '</script>',
  `</script>
<style>
.moon-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 310px;
  align-items: center;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px;
  background: #151d1b;
}

.moon-hero__art {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 44%;
  filter: saturate(0.9) contrast(1.04);
}

.moon-hero::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  background: linear-gradient(90deg, rgba(13, 19, 18, 0.97) 0%, rgba(13, 19, 18, 0.82) 48%, rgba(13, 19, 18, 0.12) 100%);
}

.moon-hero__content {
  display: flex;
  width: min(720px, 78%);
  flex-direction: column;
  align-items: flex-start;
  padding: 32px 40px;
  color: #f3f4ec;
}

.moon-hero__brandline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.moon-hero__logo {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  object-fit: cover;
}

.moon-hero__wordmark {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.moon-hero__caption {
  color: rgba(243, 244, 236, 0.66);
  font-size: 10px;
  line-height: 1.5;
}

.moon-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 24px;
  color: #f2b56b;
  font-size: 11px;
  font-weight: 700;
}

.moon-hero h1 {
  margin: 10px 0 8px;
  color: #f3f4ec;
  font-size: 36px;
  font-weight: 750;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.moon-hero__status {
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(243, 244, 236, 0.72);
  font-size: 12px;
}

.moon-hero__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c5ee58;
  box-shadow: 0 0 10px rgba(197, 238, 88, 0.6);
}

.moon-hero__separator {
  opacity: 0.5;
}

.moon-hero__play {
  min-width: 174px;
  min-height: 50px;
  border-radius: 6px;
  font-weight: 750;
}

.moon-quick-access {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.moon-quick-access__group {
  min-width: 0;
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.56);
}

.moon-quick-access__heading {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 13px;
  font-size: 13px;
  font-weight: 700;
}

.moon-quick-access__index {
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.moon-section-icon {
  display: grid;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--v-theme-accent), 0.16);
  color: rgb(var(--v-theme-accent));
}

.moon-quick-access__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.moon-action-button {
  justify-content: flex-start;
  min-width: 0;
  padding-inline: 12px;
  text-align: left;
}

.moon-action-button .moon-action-button__icon {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.16);
  color: rgb(var(--v-theme-primary));
}

.sidebar .sidebar-item__icon {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  transition: background-color 140ms ease, color 140ms ease;
}

.sidebar a[aria-current='page'] .sidebar-item__icon,
.sidebar :is(a, button):hover .sidebar-item__icon {
  background: rgba(var(--v-theme-accent), 0.2);
  color: rgb(var(--v-theme-accent));
}

@media (max-width: 1000px) {
  .moon-quick-access {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .moon-hero {
    min-height: 270px;
  }

  .moon-hero__content {
    width: 100%;
    padding: 22px;
  }

  .moon-hero h1 {
    font-size: 28px;
  }
}
</style>`,
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
await copyFile(path.join(renderer, 'src/assets/banners/1.20.webp'), path.join(rendererAssets, 'moon-hero.webp'));

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