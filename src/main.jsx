import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine, ArrowLeft, ArrowUpRight, Blocks, Check, ChevronDown,
  CircleHelp, Compass, Cpu, Download, Gamepad2, HardDrive, Layers3, LoaderCircle,
  LogOut, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  UserRound, X
} from 'lucide-react';
import './styles.css';

const pages = [
  { id: 'home', label: 'Beranda', icon: Gamepad2 },
  { id: 'mods', label: 'Jelajahi mod', icon: Compass },
  { id: 'instances', label: 'Instalasi', icon: Layers3 },
];

const minecraftVersions = ['1.21.4', '1.21.1', '1.20.1', '1.19.4'];
const modLoaders = ['Fabric'];
const NoomAndroid = registerPlugin('NoomAndroid');

function App() {
  const [page, setPage] = useState('home');
  const [version, setVersion] = useState(minecraftVersions[0]);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [loader, setLoader] = useState(modLoaders[0]);
  const [mods, setMods] = useState([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [modsFolderConfigured, setModsFolderConfigured] = useState(false);

  useEffect(() => {
    NoomAndroid.getModsFolder().then((result) => setModsFolderConfigured(result.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    if (page !== 'mods') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setModsLoading(true);
      try {
        const facets = [['project_type:mod']];
        if (loader !== modLoaders[0]) facets.push([`categories:${loader.toLowerCase()}`]);
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
  }, [page, query, loader]);

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

  async function connectAccount(type) {
    setStatus('Membuka PojavLauncher untuk pengelolaan akun...');
    try {
      const result = await NoomAndroid.openPojavLauncher();
      setModal(false);
      setStatus(`${result.message} Pilih opsi akun ${type === 'elyby' ? 'Ely.by jika tersedia di versi Pojav-mu' : type === 'microsoft' ? 'Microsoft' : 'offline'} di sana.`);
    } catch (error) {
      setStatus(error.message);
    }
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
            <button className="profile-button" onClick={() => setModal(true)}>
              <span className="avatar"><UserRound size={15} /></span>
              <span className="profile-copy"><strong>PojavLauncher</strong><small>AKUN DIKELOLA DI SANA</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        {page === 'home' && <HomePage version={version} setVersion={setVersion} onPlay={openPojav} busy={busy} setPage={setPage} status={status} />}
        {page === 'mods' && <ModsPage query={query} setQuery={setQuery} loader={loader} setLoader={setLoader} mods={mods} loading={modsLoading} onAdd={addMod} status={status} />}
        {page === 'instances' && <InstancesPage onOpenPojav={openPojav} />}
        {page === 'settings' && <SettingsPage onChooseModsFolder={chooseModsFolder} modsFolderConfigured={modsFolderConfigured} onOpenPojav={openPojav} />}
      </main>

      {modal && <AccountModal onClose={() => setModal(false)} onConnect={connectAccount} status={status} />}
      {status && !modal && <div className="toast" role="status"><span>{status}</span><button onClick={() => setStatus('')} aria-label="Tutup"><X size={15} /></button></div>}
    </div>
  );
}

function HomePage({ version, setVersion, onPlay, busy, setPage, status }) {
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
              <select value={version} onChange={(event) => setVersion(event.target.value)} aria-label="Pilih versi Minecraft">
                {minecraftVersions.map((item) => <option key={item}>{item}</option>)}
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

function ModsPage({ query, setQuery, loader, setLoader, mods, loading, onAdd, status }) {
  return (
    <div className="page mods-page">
      <div className="page-title-row"><div><div className="section-kicker">MODRINTH · MINECRAFT JAVA</div><h1>Katalog mod</h1><p>Modifikasi duniamu, dengan cara yang kamu suka.</p></div><div className="mod-count">{loading ? 'MEMUAT...' : `${mods.length} HASIL`}</div></div>
      <div className="mod-toolbar">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari mod, pembuat, atau koleksi..." /><kbd>⌘ K</kbd></label>
        <label className="filter-select"><SlidersHorizontal size={16} /><select value={loader} onChange={(event) => setLoader(event.target.value)} aria-label="Filter loader">{modLoaders.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
      </div>
      {status && <div className="catalog-status">{status}</div>}
      <div className="mod-list">
        {loading && <div className="loading-row"><LoaderCircle className="spin" size={19} /> Memuat mod dari Modrinth...</div>}
        {!loading && mods.map((mod) => (
          <article className="mod-row" key={mod.project_id}>
            <img className="mod-avatar" src={mod.icon_url || ''} alt="" />
            <div className="mod-info"><div className="mod-name-row"><h2>{mod.title}</h2><span className="mod-category">{mod.categories?.[0] ?? 'MOD'}</span></div><p>{mod.description}</p><div className="mod-meta"><span>{mod.author}</span><span className="meta-dot" /><span><Download size={12} /> {Intl.NumberFormat('id-ID', { notation: 'compact' }).format(mod.downloads)}</span><span className="meta-dot" /><span>{mod.follows?.toLocaleString('id-ID')} pengikut</span></div></div>
            <button className="install-button" onClick={() => onAdd(mod)} title={`Pasang ${mod.title}`}><Plus size={17} /><span>Pasang</span></button>
          </article>
        ))}
        {!loading && mods.length === 0 && <div className="empty-results"><Sparkles size={21} /><strong>Belum ada hasil</strong><span>Coba kata pencarian yang berbeda.</span></div>}
      </div>
      <div className="catalog-footer"><ShieldCheck size={15} /> Katalog disediakan oleh Modrinth <a href="https://modrinth.com" target="_blank" rel="noreferrer">Tentang Modrinth <ArrowUpRight size={12} /></a></div>
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
      <div className="settings-foot"><ShieldCheck size={15} /> Unduhan mod berasal dari Modrinth; autentikasi dilakukan di Pojav.</div>
    </div>
  );
}

function AccountModal({ onClose, onConnect, status }) {
  const [tab, setTab] = useState('offline');
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-heading">
        <div className="modal-top"><span className="section-kicker">AKUN MINECRAFT</span><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={19} /></button></div>
        <h2 id="account-heading">Akun tetap<br />di Pojav.</h2>
        <div className="account-tabs" role="tablist">
          <button className={tab === 'offline' ? 'selected' : ''} onClick={() => setTab('offline')}>Offline</button>
          <button className={tab === 'microsoft' ? 'selected' : ''} onClick={() => setTab('microsoft')}>Microsoft</button>
          <button className={tab === 'elyby' ? 'selected' : ''} onClick={() => setTab('elyby')}>Ely.by</button>
        </div>
        {tab === 'offline' && <div className="account-form"><p>Untuk bermain offline, pilih profil offline langsung di PojavLauncher. Noom tidak membuat atau menyimpan profil game.</p><div className="account-assurance"><ShieldCheck size={17} /> Nama profil tetap di Pojav</div><button className="modal-submit" onClick={() => onConnect('offline')}>BUKA POJAV <ArrowUpRight size={16} /></button></div>}
        {tab === 'microsoft' && <div className="account-form"><p>Masuk di PojavLauncher dengan akun Microsoft yang memiliki Minecraft Java Edition.</p><div className="account-assurance"><ShieldCheck size={17} /> Login resmi ditangani Pojav</div><button className="modal-submit" onClick={() => onConnect('microsoft')}>BUKA POJAV <ArrowUpRight size={16} /></button></div>}
        {tab === 'elyby' && <div className="account-form"><p>Dukungan Ely.by bergantung pada versi Pojav atau fork yang kamu gunakan. Atur server autentikasi dari aplikasi tersebut jika tersedia.</p><div className="account-assurance warning"><ShieldCheck size={17} /> Jangan masukkan password Ely.by di Noom</div><button className="modal-submit" onClick={() => onConnect('elyby')}>BUKA POJAV <ArrowUpRight size={16} /></button></div>}
        {status && <div className="modal-status">{status}</div>}
        <div className="modal-foot">Noom hanya membuka aplikasi Pojav yang sudah terpasang.</div>
      </section>
    </div>
  );
}

export default App;

createRoot(document.getElementById('root')).render(<App />);