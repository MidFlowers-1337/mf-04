CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('book', 'movie', 'music')),
    creator TEXT,
    tags TEXT,
    rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'want' CHECK(status IN ('want', 'doing', 'done')),
    start_date TEXT,
    end_date TEXT,
    total_episodes INTEGER,
    current_episode INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_items_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(item_type, status);
