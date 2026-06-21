import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
import json

app = create_app()

with app.app_context():
    from db import init_db
    init_db(app)
    print('DB init OK')
    
    # 测试一下数据里有什么
    from models.repository import ItemRepository, TagRepository
    
    tags = TagRepository.list_tags()
    print(f'\n现有标签: {len(tags)} 个')
    for t in tags:
        print(f'  #{t["id"]} {t["name"]} usage={t["usage_count"]}')
    
    items = ItemRepository.list_items()
    print(f'\n现有条目: {len(items)} 条')
    for it in items[:3]:
        tl = [t['name'] for t in it.get('tag_list', [])]
        print(f'  [{it["item_type"]}] {it["title"]} rating={it["rating"]} tags_csv="{it["tags"]}" tag_list={tl}')
    
    # 尝试创建一个条目
    print('\n=== 测试创建条目 ===')
    from services.items import ItemService
    try:
        new_item = ItemService.create_item({
            'title': '测试-调试用',
            'item_type': 'book',
            'status': 'want',
            'tag_names': ['测试标签', '科幻'],
            'rating_writing': 4,
            'rating_plot': 5,
            'rating_idea': 3,
        })
        print(f'创建成功! id={new_item["id"]} title={new_item["title"]}')
        print(f'  rating={new_item["rating"]}')
        print(f'  tag_list={new_item["tag_list"]}')
    except Exception as e:
        import traceback
        print(f'创建失败: {e}')
        traceback.print_exc()

print('\nDone')
