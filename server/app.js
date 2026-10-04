import express from 'express';
import { createGeocoder } from './maps.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { openStore } from './store.js';
import { openPostgres } from './postgres.js';
import { fail, string, meetingInput, placeInput } from './validation.js';
import { allowedSlots, calculate, meetingDates } from '../shared/time.js';
const scrypt = promisify(scryptCallback);
const token = () => randomBytes(32).toString('base64url');
const hash = s => createHash('sha256').update(s).digest('hex');
const id = () => randomBytes(16).toString('base64url');
export function createApp({
  dbPath = process.env.DATABASE_PATH || 'data/moimpyo.sqlite',
  production = false,
  origin = process.env.APP_ORIGIN
} = {}) {
  if (production && !origin?.startsWith('https://')) throw new Error('운영 환경에서는 https APP_ORIGIN을 설정하세요.');
  const db = process.env.DATABASE_URL ? openPostgres(process.env.DATABASE_URL) : openStore(dbPath),
    app = express();
  const geocode = createGeocoder();
  app.disable('x-powered-by');
  if (!db.kind) {
    let tail = Promise.resolve();
    app.use('/api', async (req, res, next) => {
      const prior = tail;
      let release;
      tail = new Promise(resolve => {
        release = resolve;
      });
      await prior;
      res.once('finish', release);
      res.once('close', release);
      next();
    });
  }
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: production ? {
      directives: {
        'upgrade-insecure-requests': [],
        'style-src': ["'self'", "'unsafe-inline'"],
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-src': ['https://www.openstreetmap.org']
      }
    } : false,
    strictTransportSecurity: production ? undefined : false,
    referrerPolicy: {
      policy: 'no-referrer'
    }
  }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-Moimpyo') !== '1') return res.status(403).json({
        error: '요청을 확인할 수 없습니다. 새로고침해 주세요.'
      });
      const expected = origin || `${req.protocol}://${req.get('host')}`;
      if (req.get('origin') && req.get('origin') !== expected) return res.status(403).json({
        error: '허용되지 않은 사이트의 요청입니다.'
      });
      if (!req.is('application/json')) return res.status(415).json({
        error: '잘못된 요청 형식입니다.'
      });
    }
    next();
  });
  app.use(express.json({
    limit: '128kb'
  }));
  const limiter = (limit, windowMs) => rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
    }
  });
  app.use('/api', limiter(600, 10 * 60 * 1000));
  app.use('/api/auth', limiter(25, 15 * 60 * 1000));
  const cookie = (res, key, value, days) => res.cookie(key, value, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    maxAge: days * 86400000
  });
  app.use('/api', async (req, res, next) => {
    req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a.length === 2));
    const raw = req.cookies.mp_session;
    req.user = raw ? await db.prepare('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').get(hash(raw), Date.now()) : null;
    req.identity = req.user ? `user:${req.user.id}` : req.cookies.mp_guest ? `guest:${hash(req.cookies.mp_guest)}` : null;
    next();
  });
  const requireUser = req => {
    if (!req.user) fail('로그인 후 이용해 주세요.', 401);
    return req.user;
  };
  const getMeeting = async req => {
    const row = await db.prepare('SELECT * FROM meetings WHERE id=?').get(req.params.id);
    if (!row) fail('모임을 찾을 수 없습니다. 초대 링크를 다시 확인해 주세요.', 404);
    if (req.identity && (await db.prepare('SELECT 1 FROM removed_participants WHERE meeting=? AND identity=?').get(row.id, req.identity))) fail('주최자가 이 모임에서 내보냈습니다.', 403);
    return {
      ...JSON.parse(row.data),
      id: row.id,
      owner: row.owner
    };
  };
  const requireOwner = (req, m) => {
    if (requireUser(req).id !== m.owner) fail('주최자만 변경할 수 있습니다.', 403);
  };
  const persist = async m => {
    const {
      id: mid,
      owner,
      ...data
    } = m;
    await db.prepare('UPDATE meetings SET data=? WHERE id=?').run(JSON.stringify(data), mid);
  };
  const participant = async (req, res, m) => {
    const name = string(req.body.name, '참여자 이름', 40, true);
    if (!req.identity) {
      const raw = token();
      cookie(res, 'mp_guest', raw, 365);
      req.identity = `guest:${hash(raw)}`;
    }
    let p = await db.prepare('SELECT * FROM participants WHERE meeting=? AND identity=?').get(m.id, req.identity);
    if (!p) {
      p = {
        id: id()
      };
      await db.prepare('INSERT INTO participants(id,meeting,identity,name,revision) VALUES(?,?,?,?,?)').run(p.id, m.id, req.identity, name, m.revision);
    } else await db.prepare('UPDATE participants SET name=? WHERE id=?').run(name, p.id);
    return p;
  };
  const checkRevision = (req, m) => {
    if (req.body.revision !== m.revision) fail('모임 설정이 바뀌었습니다. 새로고침 후 다시 확인해 주세요.', 409);
  };
  const transaction = async fn => {
    if (db.transaction) return db.transaction(fn);
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  // Lock each meeting before validating or mutating it across serverless instances.
  // Send success only after the transaction has committed.
  const meetingWrite = handler => async (req, res) => {
    if (!db.transaction) return handler(req, res);
    const send = res.json;
    let payload;
    res.json = value => { payload = value; return res; };
    try {
      await db.transaction(async () => {
        await db.prepare('SELECT id FROM meetings WHERE id=? FOR UPDATE').get(req.params.id);
        await handler(req, res);
      });
    } finally { res.json = send; }
    return res.json(payload);
  };
  app.get('/api/me', (req, res) => res.json({
    user: req.user || null
  }));
  app.post('/api/auth/:action', async (req, res) => {
    const {
      action
    } = req.params;
    if (!['register', 'login'].includes(action)) fail('잘못된 요청입니다.', 404);
    const email = string(req.body.email, '아이디', 254, true).toLowerCase();
    const password = string(req.body.password, '비밀번호', 131072, true);
    let user = await db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (action === 'register') {
      if (user) fail('이미 등록된 아이디입니다. 로그인해 주세요.', 409);
      const name = string(req.body.name, '이름', 40, true),
        salt = token();
      const key = await scrypt(password, salt, 64);
      user = {
        id: id(),
        email,
        name
      };
      try {
        await db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(user.id, email, `${salt}:${key.toString('hex')}`, name);
      } catch (e) {
        if (e.code?.includes('SQLITE') || e.code === '23505') fail('이미 등록된 아이디입니다.', 409);
        throw e;
      }
    } else {
      const [salt, stored] = (user?.password || `${'0'.repeat(43)}:${'0'.repeat(128)}`).split(':');
      const key = await scrypt(password, salt, 64);
      if (!timingSafeEqual(key, Buffer.from(stored, 'hex')) || !user) fail('아이디 또는 비밀번호가 올바르지 않습니다.', 401);
    }
    await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    if (req.cookies.mp_session) await db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(req.cookies.mp_session));
    const raw = token();
    await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(raw), user.id, Date.now() + 30 * 86400000);
    cookie(res, 'mp_session', raw, 30);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  });
  app.post('/api/logout', async (req, res) => {
    if (req.cookies.mp_session) await db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(req.cookies.mp_session));
    cookie(res, 'mp_session', '', 0);
    res.json({
      ok: true
    });
  });
  app.get('/api/meetings', async (req, res) => {
    if (!req.identity) return res.json([]);
    const rows = await db.prepare(`SELECT m.* FROM meetings m WHERE m.owner=? OR EXISTS
      (SELECT 1 FROM participants p WHERE p.meeting=m.id AND p.identity=?) ORDER BY m.rowid DESC`).all(req.user?.id ?? null, req.identity);
    res.json(rows.map(row => ({
      ...JSON.parse(row.data),
      id: row.id,
      isOwner: !!req.user && row.owner === req.user.id
    })));
  });
  app.post('/api/meetings', async (req, res) => {
    const user = requireUser(req),
      data = meetingInput(req.body),
      mid = id();
    await db.prepare('INSERT INTO meetings(id,owner,data) VALUES(?,?,?)').run(mid, user.id, JSON.stringify({
      ...data,
      revision: 1,
      timeRevision: 1,
      finalizedTime: null,
      finalizedPlace: data.directPlace,
      createdAt: new Date().toISOString()
    }));
    res.status(201).json({
      id: mid
    });
  });
  app.delete('/api/meetings/:id', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    requireOwner(req, m);
    checkRevision(req, m);
    await transaction(async () => {
      await db.prepare('DELETE FROM votes WHERE participant IN (SELECT id FROM participants WHERE meeting=?) OR place IN (SELECT id FROM places WHERE meeting=?)').run(m.id, m.id);
      await db.prepare('DELETE FROM participants WHERE meeting=?').run(m.id);
      await db.prepare('DELETE FROM places WHERE meeting=?').run(m.id);
      await db.prepare('DELETE FROM removed_participants WHERE meeting=?').run(m.id);
      await db.prepare('DELETE FROM meetings WHERE id=?').run(m.id);
    });
    res.json({
      ok: true
    });
  }));
  app.get('/api/meetings/:id/map', async (req, res) => {
    const m = await getMeeting(req),
      address = m.finalizedPlace?.address?.trim();
    if (!address || /^https?:\/\//i.test(address)) return res.json({
      point: null
    });
    try {
      res.json({
        point: await geocode(address)
      });
    } catch {
      res.status(503).json({
        error: '지도를 불러오지 못했어요. 주소 링크를 이용해 주세요.'
      });
    }
  });
  app.get('/api/meetings/:id', async (req, res) => {
    const m = await getMeeting(req);
    const participants = await db.prepare('SELECT * FROM participants WHERE meeting=?').all(m.id);
    const responses = participants.filter(p => p.slots !== null).map(p => ({
      id: p.id,
      name: p.name,
      slots: JSON.parse(p.slots),
      revision: p.revision
    }));
    const mine = participants.find(p => p.identity === req.identity);
    const places = (await db.prepare('SELECT p.*, (SELECT COUNT(*) FROM votes v WHERE v.place=p.id) AS count FROM places p WHERE meeting=? ORDER BY count DESC, p.rowid ASC').all(m.id)).map(({
      creator,
      ...p
    }) => ({
      ...p,
      canEdit: !!mine && creator === mine.id
    }));
    const myVotes = mine ? (await db.prepare('SELECT place FROM votes WHERE participant=?').all(mine.id)).map(v => v.place) : [];
    const valid = new Set(allowedSlots(m));
    const {
      owner,
      ...publicMeeting
    } = m;
    res.json({
      meeting: publicMeeting,
      isOwner: req.user?.id === owner,
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        responded: p.slots !== null,
        revision: p.revision,
        isMine: p.identity === req.identity,
        isOwner: p.identity === `user:${owner}`
      })),
      responses,
      result: calculate(m, responses),
      places,
      myVotes,
      mine: mine ? {
        id: mine.id,
        name: mine.name,
        slots: mine.slots === null ? null : JSON.parse(mine.slots),
        revision: mine.revision,
        outsideCount: mine.slots ? JSON.parse(mine.slots).filter(s => !valid.has(s)).length : 0
      } : null
    });
  });
  app.post('/api/meetings/:id/join', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    const existing = req.identity && (await db.prepare('SELECT id FROM participants WHERE meeting=? AND identity=?').get(m.id, req.identity));
    if (!existing) await transaction(async () => {
      req.body.name = req.body.name || (req.user?.id === m.owner ? req.user.name : '');
      await participant(req, res, m);
    });
    if (existing && req.body.name !== undefined) {
      const name = string(req.body.name, '참여자 이름', 40, true);
      await db.prepare('UPDATE participants SET name=? WHERE id=?').run(name, existing.id);
    }
    res.json({ ok: true });
  }));
  app.patch('/api/meetings/:id/participants/me', meetingWrite(async (req, res) => {
    const m = await getMeeting(req),
      name = string(req.body.name, '참여자 이름', 40, true);
    const p = req.identity && (await db.prepare('SELECT id FROM participants WHERE meeting=? AND identity=?').get(m.id, req.identity));
    if (!p) fail('먼저 모임에 참여해 주세요.', 403);
    await db.prepare('UPDATE participants SET name=? WHERE id=?').run(name, p.id);
    res.json({
      ok: true
    });
  }));
  app.post('/api/meetings/:id/participants/:participantId/remove', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    requireOwner(req, m);
    checkRevision(req, m);
    const p = await db.prepare('SELECT * FROM participants WHERE id=? AND meeting=?').get(req.params.participantId, m.id);
    if (!p) fail('참여자를 찾을 수 없습니다.', 404);
    if (p.identity === `user:${m.owner}`) fail('주최자는 내보낼 수 없습니다.');
    await transaction(async () => {
      await db.prepare('INSERT OR IGNORE INTO removed_participants VALUES(?,?)').run(m.id, p.identity);
      await db.prepare('DELETE FROM votes WHERE participant=?').run(p.id);
      await db.prepare('DELETE FROM participants WHERE id=?').run(p.id);
    });
    res.json({
      ok: true
    });
  }));
  app.patch('/api/meetings/:id', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    requireOwner(req, m);
    checkRevision(req, m);
    const data = meetingInput(req.body);
    const timeChanged = JSON.stringify(meetingDates(m)) !== JSON.stringify(meetingDates(data)) || ['startDate', 'endDate', 'startMinute', 'endMinute', 'duration'].some(k => m[k] !== data[k]);
    const placeChanged = m.placeMode !== data.placeMode || JSON.stringify(m.directPlace) !== JSON.stringify(data.directPlace);
    const responseCount = (await db.prepare('SELECT COUNT(*) AS n FROM participants WHERE meeting=? AND slots IS NOT NULL').get(m.id)).n;
    if ((timeChanged || placeChanged) && responseCount && req.body.acknowledge !== true) fail('기존 응답과 확정 결과에 미치는 영향을 확인해 주세요.', 409);
    await persist({
      ...m,
      ...data,
      revision: m.revision + 1,
      timeRevision: timeChanged ? m.revision + 1 : m.timeRevision,
      finalizedTime: timeChanged ? null : m.finalizedTime,
      finalizedPlace: placeChanged ? data.directPlace : m.finalizedPlace
    });
    res.json({
      ok: true
    });
  }));
  app.put('/api/meetings/:id/response', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    checkRevision(req, m);
    const valid = new Set(allowedSlots(m));
    if (!Array.isArray(req.body.slots) || req.body.slots.length > valid.size || req.body.slots.some(k => !valid.has(k))) fail('선택 범위 밖의 시간이 있습니다. 새로고침해 주세요.');
    await transaction(async () => {
      const p = await participant(req, res, m);
      const old = p.slots ? JSON.parse(p.slots).filter(k => !valid.has(k)) : [];
      await db.prepare('UPDATE participants SET slots=?,revision=? WHERE id=?').run(JSON.stringify([...new Set([...old, ...req.body.slots])]), m.revision, p.id);
    });
    res.json({
      ok: true
    });
  }));
  app.post('/api/meetings/:id/places', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    checkRevision(req, m);
    if (m.placeMode !== 'together' || m.finalizedPlace) fail('현재 장소 후보를 추가할 수 없습니다.', 409);
    const p = placeInput(req.body.place || {});
    if ((await db.prepare('SELECT COUNT(*) AS n FROM places WHERE meeting=?').get(m.id)).n >= 50) fail('장소 후보는 최대 50개까지 추가할 수 있습니다.');
    await transaction(async () => {
      const author = await participant(req, res, m);
      await db.prepare('INSERT INTO places(id,meeting,name,address,note,creator) VALUES(?,?,?,?,?,?)').run(id(), m.id, p.name, p.address, p.note, author.id);
    });
    res.status(201).json({
      ok: true
    });
  }));
  for (const method of ['patch', 'delete']) app[method]('/api/meetings/:id/places/:placeId', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    checkRevision(req, m);
    if (m.placeMode !== 'together' || m.finalizedPlace) fail('장소 확정을 해제한 후 수정할 수 있어요.', 409);
    const p = await db.prepare('SELECT * FROM places WHERE id=? AND meeting=?').get(req.params.placeId, m.id);
    if (!p) fail('장소 후보를 찾을 수 없어요.', 404);
    const mine = req.identity && (await db.prepare('SELECT id FROM participants WHERE meeting=? AND identity=?').get(m.id, req.identity));
    if (!mine || p.creator !== mine.id) fail('이 후보를 추가한 사람만 수정하거나 삭제할 수 있어요.', 403);
    const next = method === 'patch' ? placeInput(req.body.place || {}) : null;
    await transaction(async () => {
      if (next) await db.prepare('UPDATE places SET name=?,address=?,note=? WHERE id=?').run(next.name, next.address, next.note, p.id);else {
        await db.prepare('DELETE FROM votes WHERE place=?').run(p.id);
        await db.prepare('DELETE FROM places WHERE id=?').run(p.id);
      }
    });
    res.json({
      ok: true
    });
  }));
  app.put('/api/meetings/:id/votes', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    checkRevision(req, m);
    if (m.placeMode !== 'together' || m.finalizedPlace) fail('현재 장소 투표를 수정할 수 없습니다.', 409);
    const valid = new Set((await db.prepare('SELECT id FROM places WHERE meeting=?').all(m.id)).map(p => p.id));
    if (!Array.isArray(req.body.places) || req.body.places.length > 50 || req.body.places.some(p => !valid.has(p))) fail('장소 후보를 다시 확인해 주세요.');
    await transaction(async () => {
      const p = await participant(req, res, m);
      await db.prepare('DELETE FROM votes WHERE participant=?').run(p.id);
      for (const pid of new Set(req.body.places)) await db.prepare('INSERT INTO votes VALUES(?,?)').run(p.id, pid);
    });
    res.json({
      ok: true
    });
  }));
  app.post('/api/meetings/:id/finalize/:kind', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    requireOwner(req, m);
    checkRevision(req, m);
    if (req.params.kind === 'time') {
      const {
        date,
        start
      } = req.body;
      if (!meetingDates(m).includes(date) || !Number.isInteger(start) || start % 30 || start < m.startMinute || start >= m.endMinute || m.duration !== null && start + m.duration > m.endMinute) fail('확정할 시작 시간을 다시 확인해 주세요.');
      m.finalizedTime = {
        date,
        start,
        end: m.duration === null ? null : start + m.duration
      };
    } else if (req.params.kind === 'place') {
      if (m.placeMode !== 'together') fail('함께 정하기에서 장소 후보를 확정할 수 있습니다.');
      const p = await db.prepare('SELECT * FROM places WHERE id=? AND meeting=?').get(req.body.placeId || '', m.id);
      if (!p) fail('장소 후보를 찾을 수 없습니다.');
      m.finalizedPlace = {
        name: p.name,
        address: p.address,
        note: p.note,
        id: p.id
      };
    } else fail('잘못된 요청입니다.', 404);
    m.revision++;
    await persist(m);
    res.json({
      ok: true
    });
  }));
  app.post('/api/meetings/:id/reopen/:kind', meetingWrite(async (req, res) => {
    const m = await getMeeting(req);
    requireOwner(req, m);
    checkRevision(req, m);
    if (req.params.kind === 'time') m.finalizedTime = null;else if (req.params.kind === 'place' && m.placeMode === 'together') m.finalizedPlace = null;else fail('이 항목은 모임 설정에서 변경해 주세요.');
    m.revision++;
    await persist(m);
    res.json({
      ok: true
    });
  }));
  app.use('/api', (req, res) => res.status(404).json({
    error: '요청한 기능을 찾을 수 없습니다.'
  }));
  app.use((err, req, res, next) => {
    if (!req.path.startsWith('/api')) return next(err);
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({
      error: err.status ? err.message : '저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    });
  });
  return {
    app,
    db
  };
}
