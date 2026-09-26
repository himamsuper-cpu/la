import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, Blocks, Check, ChevronDown,
  CircleHelp, Compass, Cpu, Download, Gamepad2, HardDrive, Layers3, LoaderCircle,
  LogOut, Plus, Search, Settings2, ShieldCheck, Sparkles,
  UserRound, X
} from 'lucide-react';
import './styles.css';

const pages = [
  { id: 'home', label: 'Beranda', icon: Gamepad2 },
  { id: 'mods', label: 'Jelajahi mod', icon: Compass },
  { id: 'instances', label: 'Instalasi', icon: Layers3 },
];

const fallbackMinecraftVersions = ['1.21.4', '1.21.1', '1.20.1', '1.19.4'];
const modLoaders = ['Fabric', 'Forge', 'NeoForge'];
const contentTypes = [
  { id: 'mod', label: 'Mod' },
  { id: 'modpack', label: 'Modpack' },
  { id: 'resourcepack', label: 'Resource pack' },
  { id: 'shader', label: 'Shader' },
  { id: 'datapack', label: 'Data pack' },
  { id: 'world', label: 'World' },
];
const NoomAndroid = registerPlugin('NoomAndroid');

function App() {
  const [page, setPage] = useState('home');
  const [initialVersion] = useState(() => localStorage.getItem('noom.minecraftVersion') || '');
  const [version, setVersion] = useState(initialVersion || fallbackMinecraftVersions[0]);
  const [minecraftVersions, setMinecraftVersions] = useState(fallbackMinecraftVersions);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [loader, setLoader] = useState(modLoaders[0]);
  const [contentType, setContentType] = useState('mod');
  const [mods, setMods] = useState([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [modsFolderConfigured, setModsFolderConfigured] = useState(false);
  const [offlineProfiles, setOfflineProfiles] = useState(() => {
    try {
      const savedProfiles = JSON.parse(localStorage.getItem('noom.offlineProfiles') || '[]');
      return Array.isArray(savedProfiles) ? savedProfiles : [];
    } catch {
      return [];
    }
  });
  const [activeOfflineProfile, setActiveOfflineProfile] = useState(() => localStorage.getItem('noom.activeOfflineProfile') || '');

  useEffect(() => {
    localStorage.setItem('noom.offlineProfiles', JSON.stringify(offlineProfiles));
  }, [offlineProfiles]);

  useEffect(() => {
    localStorage.setItem('noom.activeOfflineProfile', activeOfflineProfile);
  }, [activeOfflineProfile]);

  useEffect(() => {
    let cancelled = false;
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')
      .then((response) => {
        if (!response.ok) throw new Error('Manifest versi Minecraft tidak tersedia.');
        return response.json();
      })
      .then((manifest) => {
        if (cancelled) return;
        const versions = manifest.versions?.map((entry) => entry.id).filter(Boolean) ?? [];
        if (versions.length === 0) throw new Error('Manifest versi Minecraft kosong.');
        setMinecraftVersions(versions);
        setVersion((current) => {
          if (initialVersion && versions.includes(initialVersion)) return initialVersion;
          if (versions.includes(manifest.latest?.release)) return manifest.latest.release;
          return versions.includes(current) ? current : versions[0];
        });
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = initialVersion && !fallbackMinecraftVersions.includes(initialVersion)
            ? [initialVersion, ...fallbackMinecraftVersions]
            : fallbackMinecraftVersions;
          setMinecraftVersions(fallback);
          setVersion(initialVersion || fallback[0]);
        }
      })
      .finally(() => { if (!cancelled) setVersionsLoading(false); });
    return () => { cancelled = true; };
  }, [initialVersion]);

  useEffect(() => {
    if (version) localStorage.setItem('noom.minecraftVersion', version);
  }, [version]);

  useEffect(() => {
    NoomAndroid.getModsFolder().then((result) => setModsFolderConfigured(result.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    if (page !== 'mods') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setModsLoading(true);
      try {
        const facets = [[`project_type:${contentType}`]];
        if (contentType === 'mod' || contentType === 'modpack') facets.push([`categories:${loader.toLowerCase()}`]);
        const params = new URLSearchParams({
          query,
          limit: '20',
          facets: JSON.stringify(facets),
          index: 'downloads',
        });
        const response = await fetch(`https://api.modrinth.com/v2/search?${params}`);
        if (!response.ok) throw new Error('Tidak dapat memuat katalog Modrinth.');
        const result = await response.json();
        if (!cancelled) setMods(result.hits ?? []);
      } catch (error) {
        if (!cancelled) setStatus(error.message);
      } finally {
        if (!cancelled) setModsLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, query, loader, contentType]);

  async function openPojav() {
    setBusy(true);
    setStatus('Membuka PojavLauncher...');
    try {
      const result = await NoomAndroid.openPojavLauncher();
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function addMod(mod) {
    setStatus(`Memasang ${mod.title}...`);
    try {
      const result = await NoomAndroid.installMod({ projectId: mod.project_id, version, loader });
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function downloadContent(project) {
    if (contentType === 'mod') {
      await addMod(project);
      return;
    }
    setDownloadingId(project.project_id);
    setStatus(`Mencari berkas ${project.title} untuk Minecraft ${version}...`);
    try {
      const params = new URLSearchParams({ game_versions: JSON.stringify([version]) });
      if (contentType === 'modpack') params.set('loaders', JSON.stringify([loader.toLowerCase()]));
      const response = await fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(project.project_id)}/version?${params}`);
      if (!response.ok) throw new Error('Tidak dapat memuat versi konten dari Modrinth.');
      const versions = await response.json();
      const compatibleVersion = versions.find((item) => item.files?.some((file) => file.primary)) || versions[0];
      const file = compatibleVersion?.files?.find((item) => item.primary) || compatibleVersion?.files?.[0];
      if (!file?.url || !file.filename) throw new Error(`Tidak ada berkas ${contentTypes.find((item) => item.id === contentType)?.label.toLowerCase()} untuk Minecraft ${version}.`);
      setStatus(`Menyiapkan unduhan ${file.filename}...`);
      const result = await NoomAndroid.saveDownload({ url: file.url, filename: file.filename });
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message || 'Unduhan gagal.');
    } finally {
      setDownloadingId('');
    }
  }

  async function connectAccount(type) {
    setStatus(`Login ${type === 'microsoft' ? 'Microsoft' : 'Ely.by'} belum tersedia langsung di Noom. Membuka PojavLauncher untuk autentikasi resmi...`);
    try {
      const result = await NoomAndroid.openPojavLauncher();
      setModal(false);
      setStatus(`${result.message} Noom tidak meminta atau menyimpan kata sandi akun online.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function createOfflineProfile(username) {
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      setStatus('Nama profil harus 3-16 karakter: huruf, angka, atau garis bawah.');
      return;
    }
    if (offlineProfiles.some((profile) => profile.name.toLowerCase() === name.toLowerCase())) {
      setStatus('Profil dengan nama tersebut sudah ada.');
      return;
    }
    const profile = { id: name.toLowerCase(), name };
    setOfflineProfiles((current) => [...current, profile]);
    setActiveOfflineProfile(profile.id);
    setStatus(`Profil offline ${name} disimpan di aplikasi ini.`);
  }

  async function chooseModsFolder() {
    try {
      const result = await NoomAndroid.chooseModsFolder();
      setModsFolderConfigured(result.configured);
      setStatus('Folder dipilih. Pastikan folder tersebut adalah folder mods Pojav yang aktif.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage('home')} aria-label="Noom Launcher beranda">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">noom<span>.</span></span>
        </button>
        <div className="side-caption">MAIN MENU</div>
        <nav className="nav-list" aria-label="Menu utama">
          {pages.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setStatus(''); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === 'mods' && <span className="nav-new">BARU</span>}
            </button>
          ))}
        </nav>
        <div className="side-caption library-caption">PERPUSTAKAAN</div>
        <button className="nav-item subdued" onClick={() => setPage('instances')}>
          <HardDrive size={18} strokeWidth={1.8} /><span>Versi game</span>
        </button>
        <div className="sidebar-bottom">
          <div className="storage-row"><span><HardDrive size={14} /> Penyimpanan</span><strong>—</strong></div>
          <div className="storage-track"><span /></div>
          <button className="nav-item settings-link" onClick={() => setPage('settings')}>
            <Settings2 size={18} strokeWidth={1.8} /><span>Pengaturan</span>
          </button>
          <div className="sidebar-version">NOOM LAUNCHER <span>v1.0.0</span></div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>NOOM</span><span className="crumb-slash">/</span><strong>{page === 'home' ? 'BERANDA' : page === 'mods' ? 'JELAJAHI MOD' : page === 'settings' ? 'PENGATURAN' : 'INSTALASI'}</strong></div>
          <div className="top-actions">
            <button className="icon-button help-button" title="Bantuan"><CircleHelp size={17} /></button>
            <span className="top-divider" />
            <button className="profile-button" onClick={() => { setStatus(''); setModal(true); }}>
              <span className="avatar"><UserRound size={15} /></span>
              <span className="profile-copy"><strong>{offlineProfiles.find((profile) => profile.id === activeOfflineProfile)?.name || 'Belum ada akun'}</strong><small>{activeOfflineProfile ? 'PROFIL OFFLINE NOOM' : 'PILIH PROFIL'}</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        {page === 'home' && <HomePage version={version} setVersion={setVersion} versions={minecraftVersions} versionsLoading={versionsLoading} onPlay={openPojav} busy={busy} setPage={setPage} status={status} />}
        {page === 'mods' && <ModsPage query={query} setQuery={setQuery} loader={loader} version={version} setVersion={setVersion} versions={minecraftVersions} versionsLoading={versionsLoading} contentType={contentType} setContentType={setContentType} mods={mods} loading={modsLoading} downloadingId={downloadingId} onDownload={downloadContent} status={status} />}
        {page === 'instances' && <InstancesPage onOpenPojav={openPojav} />}
        {page === 'settings' && <SettingsPage onChooseModsFolder={chooseModsFolder} modsFolderConfigured={modsFolderConfigured} onOpenPojav={openPojav} />}
      </main>

      {modal && <AccountModal onClose={() => setModal(false)} onConnect={connectAccount} onCreateOffline={createOfflineProfile} profiles={offlineProfiles} activeProfile={activeOfflineProfile} onSelectProfile={setActiveOfflineProfile} status={status} />}
      {status && !modal && <div className="toast" role="status"><span>{status}</span><button onClick={() => setStatus('')} aria-label="Tutup"><X size={15} /></button></div>}
    </div>
  );
}

function HomePage({ version, setVersion, versions, versionsLoading, onPlay, busy, setPage, status }) {
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-image" />
        <div className="hero-content">
          <div className="eyebrow"><span className="live-dot" /> MINECRAFT JAVA <span className="eyebrow-sep">/</span> MELALUI POJAV</div>
          <h1>Dunia baru<br /><em>menunggumu.</em></h1>
          <p>Tempat semua petualangan Minecraft-mu dimulai.</p>
          <div className="hero-controls">
            <button className="play-button" onClick={onPlay} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={19} /> : <Gamepad2 size={19} />}
              <span>{busy ? 'MEMBUKA...' : 'BUKA POJAV'}</span>
              <span className="play-arrow">↗</span>
            </button>
            <label className="version-select-wrap">
              <span>TARGET MOD</span>
              <select value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Pilih versi Minecraft" disabled={versionsLoading}>
                {versions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
          <div className="hero-footnote">LOGIN, VERSI GAME, DAN JAVA DIKELOLA DI POJAV</div>
        </div>
        <div className="hero-index">01 <span>/</span> 03</div>
        <span className="hero-coordinate">NOOM WORLD · JAVA</span>
      </section>

      <div className="home-lower">
        <section className="news-block">
          <div className="section-heading"><div><span className="section-kicker">DARI KOMUNITAS</span><h2>Temukan cara baru<br />bermain.</h2></div><button className="text-link" onClick={() => setPage('mods')}>JELAJAHI MOD <ArrowUpRight size={15} /></button></div>
          <div className="feature-strip">
            <div className="feature-icon"><Blocks size={21} /></div>
            <div className="feature-copy"><strong>Mod favoritmu, satu tempat.</strong><span>Jelajahi ribuan mod dari Modrinth.</span></div>
            <button className="round-arrow" onClick={() => setPage('mods')} aria-label="Buka katalog mod"><ArrowUpRight size={17} /></button>
          </div>
        </section>
        <section className="status-block">
          <div className="section-kicker">STATUS PELUNCUR</div>
          <div className="status-title"><span className="status-check"><Check size={15} /></span><strong>{busy ? 'Membuka Pojav' : 'Siap membuka Pojav'}</strong></div>
          <div className="status-divider" />
          <div className="status-detail"><span>AKUN & GAME</span><strong>Dikelola di Pojav</strong></div>
          <div className="status-detail"><span>TARGET MOD</span><strong>{version} <span className="version-type">FABRIC</span></strong></div>
          {status && <div className="inline-status">{status}</div>}
        </section>
      </div>
    </div>
  );
}

function ModsPage({ query, setQuery, loader, version, setVersion, versions, versionsLoading, contentType, setContentType, mods, loading, downloadingId, onDownload, status }) {
  const selectedType = contentTypes.find((item) => item.id === contentType);
  return (
    <div className="page mods-page">
      <div className="page-title-row"><div><div className="section-kicker">MODRINTH · MINECRAFT JAVA</div><h1>Jelajahi konten</h1><p>Mod, modpack, resource pack, shader, data pack, dan world.</p></div><div className="mod-count">{loading ? 'MEMUAT...' : `${mods.length} HASIL`}</div></div>
      <div className="mod-toolbar">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari mod, pembuat, atau koleksi..." /><kbd>⌘ K</kbd></label>
        <label className="filter-select type-filter"><Blocks size={16} /><select value={contentType} onChange={(event) => setContentType(event.target.value)} aria-label="Pilih jenis konten">{contentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14} /></label>
        {(contentType === 'mod' || contentType === 'modpack') && <label className="filter-select loader-filter"><Cpu size={16} /><select value={loader} onChange={(event) => setLoader(event.target.value)} aria-label="Pilih mod loader">{modLoaders.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>}
        <label className="filter-select version-filter"><Gamepad2 size={16} /><select value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Pilih versi Minecraft" disabled={versionsLoading}>{versions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
      </div>
      {status && <div className="catalog-status">{status}</div>}
      <div className="mod-list">
        {loading && <div className="loading-row"><LoaderCircle className="spin" size={19} /> Memuat mod dari Modrinth...</div>}
        {!loading && mods.map((mod) => (
          <article className="mod-row" key={mod.project_id}>
            <img className="mod-avatar" src={mod.icon_url || ''} alt="" />
            <div className="mod-info"><div className="mod-name-row"><h2>{mod.title}</h2><span className="mod-category">{mod.categories?.[0] ?? 'MOD'}</span></div><p>{mod.description}</p><div className="mod-meta"><span>{mod.author}</span><span className="meta-dot" /><span><Download size={12} /> {Intl.NumberFormat('id-ID', { notation: 'compact' }).format(mod.downloads)}</span><span className="meta-dot" /><span>{mod.follows?.toLocaleString('id-ID')} pengikut</span></div></div>
            <button className="install-button" onClick={() => onDownload(mod)} disabled={downloadingId === mod.project_id} title={`${contentType === 'mod' ? 'Pasang' : 'Unduh'} ${mod.title}`}>
              {downloadingId === mod.project_id ? <LoaderCircle className="spin" size={17} /> : contentType === 'mod' ? <Plus size={17} /> : <Download size={17} />}
              <span>{downloadingId === mod.project_id ? 'Memproses' : contentType === 'mod' ? 'Pasang' : 'Unduh'}</span>
            </button>
          </article>
        ))}
        {!loading && mods.length === 0 && <div className="empty-results"><Sparkles size={21} /><strong>Belum ada hasil</strong><span>Coba kata pencarian yang berbeda.</span></div>}
      </div>
      <div className="catalog-footer"><ShieldCheck size={15} /><span>{contentType === 'mod' ? `Mod ${loader} dipasang ke folder mods; loader tersebut harus sudah dipasang di Pojav.` : contentType === 'modpack' ? `Modpack ${loader} diunduh sebagai .mrpack dan perlu diimpor ke launcher.` : `${selectedType?.label} diunduh ke lokasi yang kamu pilih.`} Katalog disediakan oleh Modrinth.</span><a href="https://modrinth.com" target="_blank" rel="noreferrer">Modrinth <ArrowUpRight size={12} /></a></div>
    </div>
  );
}

function InstancesPage({ onOpenPojav }) {
  return (
    <div className="page simple-page">
      <div className="page-title-row"><div><div className="section-kicker">PENGELOLA GAME ANDROID</div><h1>Instalasi</h1><p>Versi game dan profil Fabric dikelola di PojavLauncher.</p></div><button className="outline-action" onClick={onOpenPojav}><ArrowUpRight size={16} /> Buka Pojav</button></div>
      <div className="instance-row"><div className="instance-cover"><Gamepad2 size={25} /></div><div className="instance-main"><strong>PojavLauncher</strong><span>Minecraft Java Edition · Akun dan versi dikelola di aplikasi eksternal</span></div><span className="installed-label"><span className="live-dot" /> ANDROID</span></div>
      <div className="section-line" />
      <div className="setup-note"><Blocks size={19} /><div><strong>Mod Fabric melalui Modrinth</strong><span>Pilih folder mods aktif milik Pojav di Pengaturan sebelum memasang mod.</span></div><button className="text-link" onClick={onOpenPojav}>BUKA POJAV <ArrowUpRight size={15} /></button></div>
    </div>
  );
}

function SettingsPage({ onChooseModsFolder, modsFolderConfigured, onOpenPojav }) {
  return (
    <div className="page simple-page">
      <div className="page-title-row"><div><div className="section-kicker">INTEGRASI ANDROID</div><h1>Pengaturan</h1><p>Hubungkan folder mod Pojav dengan Noom.</p></div></div>
      <section className="settings-section"><div className="settings-heading"><h2>Folder mod</h2><span>01</span></div><div className="setting-row"><div><strong>{modsFolderConfigured ? 'Folder mods dipilih' : 'Pilih folder mods Pojav'}</strong><span>Pilih folder `mods` aktif yang digunakan profil Fabric di Pojav.</span></div><button className="outline-action" onClick={onChooseModsFolder}><HardDrive size={15} /> {modsFolderConfigured ? 'Ganti folder' : 'Pilih folder'}</button></div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Akun dan game</h2><span>02</span></div><div className="setting-row"><div><strong>Dikelola di PojavLauncher</strong><span>Noom tidak menerima atau menyimpan token maupun password akun.</span></div><button className="outline-action" onClick={onOpenPojav}><ArrowUpRight size={15} /> Buka Pojav</button></div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Kontrol permainan</h2><span>03</span></div><div className="setting-row"><div><strong>Atur tombol di PojavLauncher</strong><span>Gunakan editor kontrol Pojav untuk memilih layout sentuh, tombol keyboard, dan pemetaan aksi.</span></div><button className="outline-action" onClick={onOpenPojav}><Gamepad2 size={15} /> Buka Pojav</button></div></section>
      <div className="settings-foot"><ShieldCheck size={15} /> Unduhan mod berasal dari Modrinth; autentikasi dilakukan di Pojav.</div>
    </div>
  );
}

function AccountModal({ onClose, onConnect, onCreateOffline, profiles, activeProfile, onSelectProfile, status }) {
  const [tab, setTab] = useState('offline');
  const [username, setUsername] = useState('');
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-heading">
        <div className="modal-top"><span className="section-kicker">AKUN MINECRAFT</span><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={19} /></button></div>
        <h2 id="account-heading">Akun game<br />dan profilmu.</h2>
        <div className="account-tabs" role="tablist">
          <button className={tab === 'offline' ? 'selected' : ''} onClick={() => setTab('offline')}>Offline</button>
          <button className={tab === 'microsoft' ? 'selected' : ''} onClick={() => setTab('microsoft')}>Microsoft</button>
          <button className={tab === 'elyby' ? 'selected' : ''} onClick={() => setTab('elyby')}>Ely.by</button>
        </div>
        {tab === 'offline' && <div className="account-form">
          <p>Buat profil offline langsung di Noom. Nama disimpan hanya di perangkat ini; profil offline tidak memberi akses ke server yang mewajibkan akun premium.</p>
          <form onSubmit={(event) => { event.preventDefault(); onCreateOffline(username); }}>
            <label htmlFor="offline-username">NAMA PROFIL</label>
            <input id="offline-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Contoh: PemainBaru" maxLength={16} autoComplete="off" />
            <button className="modal-submit" type="submit">BUAT PROFIL OFFLINE <Plus size={16} /></button>
          </form>
          {profiles.length > 0 && <div className="offline-profile-list"><span className="section-kicker">PROFIL TERSIMPAN</span>{profiles.map((profile) => <button key={profile.id} className={`offline-profile ${profile.id === activeProfile ? 'selected' : ''}`} onClick={() => onSelectProfile(profile.id)}><UserRound size={15} /><span>{profile.name}</span>{profile.id === activeProfile && <Check size={15} />}</button>)}</div>}
          <div className="account-assurance"><ShieldCheck size={17} /> Profil offline tersimpan di aplikasi</div>
          <p className="account-note">Noom versi beta belum menjalankan game sendiri. Untuk membuka Minecraft, Pojav tetap perlu dipasang dan profil offline yang sama dipilih di sana.</p>
        </div>}
        {tab === 'microsoft' && <div className="account-form"><p>Login Microsoft belum dapat dilakukan langsung di Noom. Autentikasi yang aman perlu alur OAuth resmi dan pemeriksaan kepemilikan Minecraft Java Edition.</p><div className="account-assurance"><ShieldCheck size={17} /> Akun harus memiliki Minecraft Java Edition</div><button className="modal-submit" onClick={() => onConnect('microsoft')}>LANJUTKAN DI POJAV <ArrowUpRight size={16} /></button></div>}
        {tab === 'elyby' && <div className="account-form"><p>Gunakan email atau nama pengguna dan kata sandi yang sudah terdaftar di Ely.by hanya pada login resmi Ely.by. Login Ely.by langsung di Noom belum tersedia.</p><div className="account-assurance warning"><ShieldCheck size={17} /> Jangan masukkan kata sandi di Noom</div><button className="modal-submit" onClick={() => onConnect('elyby')}>LANJUTKAN DI POJAV <ArrowUpRight size={16} /></button></div>}
        {status && <div className="modal-status">{status}</div>}
        <div className="modal-foot">Akun online tidak pernah disimpan oleh Noom.</div>
      </section>
    </div>
  );
}

export default App;

createRoot(document.getElementById('root')).render(<App />);