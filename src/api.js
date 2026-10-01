export async function api(path, method = 'GET', body) {
  let response;
  try { response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Moimpyo': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'); }
  const data = await response.json().catch(() => ({ error: '서버 응답을 읽지 못했습니다. 다시 시도해 주세요.' }));
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}
