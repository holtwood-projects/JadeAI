import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';

function migrationsUpTo(maxIdx: number | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'jade-migrations-upgrade-'));
  const target = join(dir, 'migrations');
  cpSync('drizzle/migrations', target, { recursive: true });
  if (maxIdx !== null) {
    const journalPath = join(target, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { idx: number }[];
    };
    journal.entries = journal.entries.filter((entry) => entry.idx <= maxIdx);
    writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  }
  return target;
}

function tableNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name);
}

function indexNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all()
    .map((row) => (row as { name: string }).name);
}

const RECRUIT_TABLES = ['recruit_jobs', 'recruit_candidates', 'recruit_evaluations'];
const INDEX_MIGRATION_INDEXES = [
  'chat_messages_session_id_created_idx',
  'chat_sessions_resume_id_idx',
  'interview_messages_round_id_idx',
  'interview_rounds_session_id_idx',
  'interview_sessions_user_id_idx',
  'resume_sections_resume_id_idx',
  'resume_shares_resume_id_idx',
];

function latestAppliedAt(sqlite: Database.Database): number {
  const row = sqlite
    .prepare('SELECT MAX(created_at) AS applied FROM __drizzle_migrations')
    .get() as { applied: number | string };
  return Number(row.applied);
}

describe('migration journal', () => {
  it('keeps timestamps strictly increasing', () => {
    for (const folder of ['drizzle/migrations/meta/_journal.json', 'drizzle/pg-migrations/meta/_journal.json']) {
      const journal = JSON.parse(readFileSync(folder, 'utf8')) as {
        entries: { idx: number; when: number }[];
      };
      for (let index = 1; index < journal.entries.length; index += 1) {
        // drizzle-orm only runs a migration when its `when` is newer than the
        // last applied timestamp. A backwards timestamp is skipped forever.
        expect(journal.entries[index].when, folder).toBeGreaterThan(
          journal.entries[index - 1].when
        );
      }
    }
  });

  it('applies the recruit migration on a fresh SQLite database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jade-migrations-'));
    const sqlite = new Database(join(dir, 'test.db'));
    try {
      migrate(drizzle(sqlite), { migrationsFolder: 'drizzle/migrations' });
      expect(tableNames(sqlite)).toEqual(expect.arrayContaining(RECRUIT_TABLES));
      expect(indexNames(sqlite)).toEqual(expect.arrayContaining(INDEX_MIGRATION_INDEXES));
      expect(latestAppliedAt(sqlite)).toBe(1787388757953);
    } finally {
      sqlite.close();
    }
  });

  it('upgrades an upstream-lineage database that skipped the recruit DDL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jade-migrations-upstream-'));
    const sqlite = new Database(join(dir, 'test.db'));
    try {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: migrationsUpTo(6) });
      // Upstream's ledger stopped before the fork's 0006/0007 timestamps.
      sqlite.prepare('UPDATE __drizzle_migrations SET created_at = ?').run(1787135946275);

      migrate(db, { migrationsFolder: migrationsUpTo(null) });

      expect(tableNames(sqlite)).toEqual(expect.arrayContaining(RECRUIT_TABLES));
      expect(indexNames(sqlite)).toEqual(expect.arrayContaining(INDEX_MIGRATION_INDEXES));
      expect(latestAppliedAt(sqlite)).toBe(1787388757953);
    } finally {
      sqlite.close();
    }
  });

  it('tolerates a merge-era database whose recruit tables already exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jade-migrations-merge-'));
    const sqlite = new Database(join(dir, 'test.db'));
    try {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder: migrationsUpTo(6) });

      // Replay 0007 once, then rewind the ledger to the merge-era timestamp:
      // drizzle runs 0007 again, and its DDL must be idempotent.
      const sql = readFileSync('drizzle/migrations/0007_flawless_the_initiative.sql', 'utf8');
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) sqlite.exec(statement);
      }
      sqlite.prepare('UPDATE __drizzle_migrations SET created_at = ?').run(1787388757952);

      migrate(db, { migrationsFolder: migrationsUpTo(null) });

      expect(tableNames(sqlite)).toEqual(expect.arrayContaining(RECRUIT_TABLES));
      expect(latestAppliedAt(sqlite)).toBe(1787388757953);
    } finally {
      sqlite.close();
    }
  });
});
