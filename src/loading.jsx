import React from 'react';

export function LoadingState({ meeting = false }) {
  return <div className="loading-state" role="status" aria-live="polite"><p>{meeting ? '모임을' : '모임표를'} 불러오고 있어요<br/>잠시만 기다려주세요</p></div>;
}
