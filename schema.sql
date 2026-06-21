CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('book', 'movie', 'music')),
    creator TEXT,
    tags TEXT,
    rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
    rating_writing INTEGER CHECK(rating_writing IS NULL OR (rating_writing >= 1 AND rating_writing <= 5)),
    rating_plot INTEGER CHECK(rating_plot IS NULL OR (rating_plot >= 1 AND rating_plot <= 5)),
    rating_idea INTEGER CHECK(rating_idea IS NULL OR (rating_idea >= 1 AND rating_idea <= 5)),
    rating_story INTEGER CHECK(rating_story IS NULL OR (rating_story >= 1 AND rating_story <= 5)),
    rating_acting INTEGER CHECK(rating_acting IS NULL OR (rating_acting >= 1 AND rating_acting <= 5)),
    rating_visual INTEGER CHECK(rating_visual IS NULL OR (rating_visual >= 1 AND rating_visual <= 5)),
    rating_music INTEGER CHECK(rating_music IS NULL OR (rating_music >= 1 AND rating_music <= 5)),
    rating_melody INTEGER CHECK(rating_melody IS NULL OR (rating_melody >= 1 AND rating_melody <= 5)),
    rating_lyrics INTEGER CHECK(rating_lyrics IS NULL OR (rating_lyrics >= 1 AND rating_lyrics <= 5)),
    rating_production INTEGER CHECK(rating_production IS NULL OR (rating_production >= 1 AND rating_production <= 5)),
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

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS item_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(item_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);
