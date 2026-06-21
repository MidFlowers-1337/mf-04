import json
from models.repository import ItemRepository, ITEM_RATING_FIELDS


class ImportExportService:
    @staticmethod
    def export_all():
        items = ItemRepository.get_all_items()
        clean_items = []
        for item in items:
            clean = {k: item.get(k) for k in [
                'id', 'title', 'item_type', 'creator', 'tags', 'rating',
                'rating_writing', 'rating_plot', 'rating_idea',
                'rating_story', 'rating_acting', 'rating_visual', 'rating_music',
                'rating_melody', 'rating_lyrics', 'rating_production',
                'comment', 'status', 'start_date', 'end_date',
                'total_episodes', 'current_episode', 'sort_order',
                'created_at', 'updated_at',
            ]}
            clean['tag_list'] = item.get('tag_list', [])
            clean_items.append(clean)
        return {
            'version': '2.0',
            'exported_at': __import__('datetime').datetime.now().isoformat(),
            'items': clean_items
        }

    @staticmethod
    def validate_import_data(data):
        if not isinstance(data, dict):
            return False, 'Data must be a JSON object'
        if 'items' not in data:
            return False, 'Missing "items" field'
        if not isinstance(data['items'], list):
            return False, '"items" must be an array'
        
        required_fields = ['title', 'item_type']
        valid_types = ['book', 'movie', 'music']
        valid_statuses = ['want', 'doing', 'done']
        
        for i, item in enumerate(data['items']):
            if not isinstance(item, dict):
                return False, f'Item {i} must be an object'
            for field in required_fields:
                if field not in item:
                    return False, f'Item {i} missing required field: {field}'
            if item['item_type'] not in valid_types:
                return False, f'Item {i} invalid item_type: {item["item_type"]}'
            if 'status' in item and item['status'] not in valid_statuses:
                return False, f'Item {i} invalid status: {item["status"]}'
            for rk in ['rating'] + ITEM_RATING_FIELDS.get(item['item_type'], []):
                if rk in item and item[rk] is not None:
                    if not isinstance(item[rk], int) or item[rk] < 1 or item[rk] > 5:
                        return False, f'Item {i} invalid {rk}'
        
        return True, None

    @staticmethod
    def import_items(data):
        is_valid, error = ImportExportService.validate_import_data(data)
        if not is_valid:
            return {'success': False, 'error': error, 'imported': 0, 'skipped': 0}
        
        imported = 0
        skipped = 0
        
        for item_data in data['items']:
            existing = ItemRepository.find_by_title_and_type(
                item_data['title'], item_data['item_type']
            )
            if existing:
                skipped += 1
                continue
            
            clean_data = {
                'title': item_data['title'],
                'item_type': item_data['item_type'],
                'creator': item_data.get('creator'),
                'tags': item_data.get('tags'),
                'rating': item_data.get('rating'),
                'comment': item_data.get('comment'),
                'status': item_data.get('status', 'want'),
                'start_date': item_data.get('start_date'),
                'end_date': item_data.get('end_date'),
                'total_episodes': item_data.get('total_episodes'),
                'current_episode': item_data.get('current_episode', 0),
                'sort_order': item_data.get('sort_order', 0),
            }
            for rk in ITEM_RATING_FIELDS.get(item_data['item_type'], []):
                if rk in item_data:
                    clean_data[rk] = item_data[rk]

            if 'tag_list' in item_data and isinstance(item_data['tag_list'], list):
                clean_data['tag_names'] = [
                    t['name'] if isinstance(t, dict) else str(t)
                    for t in item_data['tag_list']
                ]

            if 'created_at' in item_data:
                clean_data['created_at'] = item_data['created_at']
                clean_data['updated_at'] = item_data.get('updated_at', item_data['created_at'])
            ItemRepository.create_item(clean_data, keep_timestamp='created_at' in item_data)
            imported += 1
        
        return {
            'success': True,
            'imported': imported,
            'skipped': skipped
        }
