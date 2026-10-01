// User-triggered, cached address lookup. Public Nominatim requests are serialized.
export function createGeocoder(fetcher = fetch) {
  const cache = new Map();
  let queue = Promise.resolve(), lastRequest = 0;
  return address => {
    if (cache.has(address)) return cache.get(address);
    const result = queue.then(async () => {
      const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      lastRequest = Date.now();
      const url = new URL(process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({ q: address, format: 'jsonv2', limit: '1' }).toString();
      const response = await fetcher(url, { headers: { 'User-Agent': 'Moimpyo/1.0 (https://github.com/khsophia06/moyimpyo)', 'Accept-Language': 'ko' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('지도를 불러오지 못했어요. 주소 링크를 이용해 주세요.');
      const [place] = await response.json();
      if (!place) return null;
      const lat = Number(place.lat), lon = Number(place.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) return null;
      return { lat, lon, label: place.display_name };
    }).catch(error => { cache.delete(address); throw error; });
    cache.set(address, result);
    queue = result.catch(() => {});
    return result;
  };
}
