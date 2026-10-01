import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, SignOut } from '@phosphor-icons/react';
import '@fontsource-variable/noto-sans-kr';
import '@fontsource-variable/inter';
import './style.css';
import { api } from './api';
import { Link, go, Notice } from './ui';
import { Dashboard, Auth } from './start';
import { MeetingForm } from './form';
import { Meeting } from './meeting';
function App() {
  const [path, setPath] = useState(location.pathname), [user, setUser] = useState(null), [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { const handler = () => setPath(location.pathname); addEventListener('popstate', handler); api('/me').then(d => setUser(d.user)).catch(e => setError(e.message)).finally(() => setReady(true)); return () => removeEventListener('popstate', handler); }, []);
  const match = path.match(/^\/m\/([^/]+)(?:\/(time|place|edit))?\/?$/);
  return <><a href="#main" className="skip-link">본문으로 건너뛰기</a><header className="site-header"><Link to="/" className="wordmark" aria-label="모임표 홈">모임표<span className="logo-grid" aria-hidden="true"><i/><i/><i/><i/></span></Link><div className="header-right"><span className="header-note">우리의 시간을 맞추는 곳</span>{user ? <><Link to="/" className="account-name">{user.name} 님</Link><button className="icon-button" aria-label="로그아웃" onClick={async () => { try { await api('/logout', 'POST', {}); setUser(null); go('/'); } catch (e) { setError(e.message); } }}><SignOut size={21}/></button></> : <Link to="/login" className="header-login">주최자 로그인 <ArrowUpRight size={16}/></Link>}</div></header><main id="main"><Notice error>{error}</Notice>{!ready ? <div className="loading">모임표를 불러오고 있어요.</div> : match ? <Meeting key={match[1]} id={match[1]} view={match[2] || 'home'} user={user}/> : path === '/login' ? <Auth onLogin={setUser}/> : path === '/new' ? user ? <MeetingForm/> : <Auth onLogin={setUser} next="/new"/> : path === '/' ? <Dashboard user={user}/> : <div className="empty"><h1>페이지를 찾을 수 없어요.</h1><Link to="/" className="text-link">모임표 홈으로</Link></div>}</main><footer className="site-footer"><span>모임표</span><span>쉽고 빠르게 모여보세요</span><span>한국 시간 · KST (UTC+9)</span></footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
