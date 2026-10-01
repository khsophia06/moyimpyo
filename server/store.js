import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, owner TEXT REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, meeting TEXT REFERENCES meetings(id), identity TEXT NOT NULL, name TEXT NOT NULL, slots TEXT, revision INTEGER NOT NULL DEFAULT 1, UNIQUE(meeting, identity));
    CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, meeting TEXT REFERENCES meetings(id), name TEXT NOT NULL, address TEXT NOT NULL, note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS votes (participant TEXT REFERENCES participants(id), place TEXT REFERENCES places(id), PRIMARY KEY(participant, place));
    CREATE TABLE IF NOT EXISTS removed_participants (meeting TEXT REFERENCES meetings(id), identity TEXT NOT NULL, PRIMARY KEY(meeting, identity));`);
  return db;
}
