import React from 'react';
import { ArrowUpRight, Check } from '@phosphor-icons/react';
export const shortDate = date => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T00:00:00+09:00'));
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export const go = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); };
export function Link({ to, children, ...props }) { return <a href={to} {...props} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(to); } }}>{children}</a>; }
export function Button({ children, secondary, className = '', ...props }) { return <button className={`${secondary ? 'button secondary' : 'button'} ${className}`} {...props}>{children}</button>; }
export function Notice({ children, error = false }) { return children ? <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
export function PlaceAddress({ name = '', address = '', mapUrl = '', generateMap = false }) {
  const isUrl = value => /^https?:\/\//i.test(value);
  const addressText = address.trim();
  const directUrl = isUrl(mapUrl.trim()) ? mapUrl.trim() : isUrl(addressText) ? addressText : '';
  const query = name.trim() || (isUrl(addressText) ? '' : addressText);
  if (!directUrl && (!generateMap || !query)) return addressText ? <p className="muted">{addressText}</p> : null;
  const href = directUrl || 'https://map.naver.com/p/search/' + encodeURIComponent(query);
  return <div>{addressText && !isUrl(addressText) && <p className="muted">{addressText}</p>}<a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{directUrl ? '지도에서 보기' : '네이버지도에서 보기'} <ArrowUpRight size={16}/></a></div>;
}
export function Status({ done, children }) { return <span className={`status ${done ? 'done' : ''}`}>{done && <Check weight="bold" size={13}/>} {children}</span>; }
