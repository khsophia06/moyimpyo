import React from 'react';
import { ArrowUpRight, Check } from '@phosphor-icons/react';
export const shortDate = date => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T00:00:00+09:00'));
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export const go = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); };
export function Link({ to, children, ...props }) { return <a href={to} {...props} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(to); } }}>{children}</a>; }
export function Button({ children, secondary, className = '', ...props }) { return <button className={`${secondary ? 'button secondary' : 'button'} ${className}`} {...props}>{children}</button>; }
export function Notice({ children, error = false }) { return children ? <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
export function PlaceAddress({ address }) { return !address ? null : /^https?:\/\//i.test(address) ? <a className="text-link" href={address} target="_blank" rel="noopener noreferrer">지도에서 보기 <ArrowUpRight size={16}/></a> : <p className="muted address">{address}</p>; }
export function Status({ done, children }) { return <span className={`status ${done ? 'done' : ''}`}>{done && <Check weight="bold" size={13}/>} {children}</span>; }
