import os
import sqlite3
from flask import g, current_app


def get_db():
    if 'db' not in g:
        db_path = os.path.join(current_app.instance_path, 'tracker.db')
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def _column_exists(db, table, column):
    rows = db.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == column for r in rows)


def _table_exists(db, table):
    row = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,)
    ).fetchone()
    return row is not None


def _ensure_rating_columns(db):
    rating_cols = [
        'rating_writing', 'rating_plot', 'rating_idea',
        'rating_story', 'rating_acting', 'rating_visual', 'rating_music',
        'rating_melody', 'rating_lyrics', 'rating_production',
    ]
    for col in rating_cols:
        if not _column_exists(db, 'items', col):
            db.execute(
                f"ALTER TABLE items ADD COLUMN {col} INTEGER "
                f"CHECK({col} IS NULL OR ({col} >= 1 AND {col} <= 5))"
            )


def _ensure_tags_tables(db):
    if not _table_exists(db, 'tags'):
        db.execute('''
            CREATE TABLE tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        ''')
    if not _table_exists(db, 'item_tags'):
        db.execute('''
            CREATE TABLE item_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(item_id, tag_id)
            )
        ''')
        db.execute('CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id)')
        db.execute('CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id)')


def _migrate_tags_from_csv(db):
    row = db.execute("SELECT COUNT(*) as c FROM item_tags").fetchone()
    if row['c'] > 0:
        return
    rows = db.execute("SELECT id, tags FROM items WHERE tags IS NOT NULL AND tags != ''").fetchall()
    for r in rows:
        item_id = r['id']
        raw = r['tags']
        names = [t.strip() for t in raw.replace('，', ',').split(',') if t.strip()]
        seen = set()
        for name in names:
            if name in seen:
                continue
            seen.add(name)
            db.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
            tag_row = db.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
            if tag_row:
                db.execute(
                    "INSERT OR IGNORE INTO item_tags(item_id, tag_id) VALUES (?, ?)",
                    (item_id, tag_row['id'])
                )


def _migrate_rating_fallback(db):
    updates = []
    rows = db.execute(
        "SELECT id, item_type, rating FROM items WHERE rating IS NOT NULL"
    ).fetchall()
    for r in rows:
        item_id = r['id']
        itype = r['item_type']
        val = r['rating']
        if itype == 'book':
            cols = ['rating_writing', 'rating_plot', 'rating_idea']
        elif itype == 'movie':
            cols = ['rating_story', 'rating_acting', 'rating_visual', 'rating_music']
        elif itype == 'music':
            cols = ['rating_melody', 'rating_lyrics', 'rating_production']
        else:
            continue
        sets = []
        params = []
        for c in cols:
            if not _column_exists(db, 'items', c):
                continue
            cur = db.execute(f"SELECT {c} FROM items WHERE id = ?", (item_id,)).fetchone()
            if cur and cur[c] is None:
                sets.append(f"{c} = ?")
                params.append(val)
        if sets:
            params.append(item_id)
            db.execute(f"UPDATE items SET {', '.join(sets)} WHERE id = ?", params)


def run_migrations(db):
    _ensure_rating_columns(db)
    _ensure_tags_tables(db)
    _migrate_tags_from_csv(db)
    _migrate_rating_fallback(db)
    db.commit()


def init_db(app):
    os.makedirs(app.instance_path, exist_ok=True)
    with app.app_context():
        db = get_db()
        schema_path = os.path.join(app.root_path, 'schema.sql')
        with open(schema_path, 'r', encoding='utf-8') as f:
            db.executescript(f.read())
        db.commit()
        run_migrations(db)
