from datetime import datetime
from models.repository import ItemRepository, TagRepository


class StatsService:
    @staticmethod
    def get_yearly_stats(year):
        items = ItemRepository.get_items_by_year(year)
        type_stats = ItemRepository.get_type_stats(year)
        monthly_stats = ItemRepository.get_monthly_stats(year)
        avg_rating = ItemRepository.get_avg_rating(year)

        monthly_data = {str(i).zfill(2): 0 for i in range(1, 13)}
        for row in monthly_stats:
            monthly_data[row['month']] = row['count']

        type_breakdown = {}
        type_avg_ratings = {}
        for row in type_stats:
            type_breakdown[row['item_type']] = row['count']
            type_avg_ratings[row['item_type']] = row['avg_rating']

        monthly_by_type = {}
        for item_type in ['book', 'movie', 'music']:
            type_monthly = ItemRepository.get_monthly_stats(year, item_type)
            type_monthly_data = {str(i).zfill(2): 0 for i in range(1, 13)}
            for row in type_monthly:
                type_monthly_data[row['month']] = row['count']
            monthly_by_type[item_type] = type_monthly_data

        done_count = sum(1 for item in items if item['status'] == 'done')
        doing_count = sum(1 for item in items if item['status'] == 'doing')
        want_count = sum(1 for item in items if item['status'] == 'want')

        rated_items = [item for item in items if item['rating'] is not None]
        if rated_items:
            avg_rating_val = sum(item['rating'] for item in rated_items) / len(rated_items)
        else:
            avg_rating_val = None

        tag_top10 = TagRepository.get_tag_top10(year)
        dimension_avgs = ItemRepository.get_dimension_avgs(year=year)

        return {
            'year': year,
            'total_count': len(items),
            'done_count': done_count,
            'doing_count': doing_count,
            'want_count': want_count,
            'avg_rating': round(avg_rating_val, 2) if avg_rating_val else None,
            'type_breakdown': type_breakdown,
            'type_avg_ratings': {k: round(v, 2) if v else None for k, v in type_avg_ratings.items()},
            'monthly_stats': monthly_data,
            'monthly_by_type': monthly_by_type,
            'top_month': max(monthly_data, key=monthly_data.get) if monthly_data else None,
            'tag_top10': tag_top10,
            'dimension_avgs': dimension_avgs,
        }

    @staticmethod
    def get_available_years():
        items = ItemRepository.get_all_items()
        years = set()
        for item in items:
            if item['created_at']:
                year = item['created_at'][:4]
                years.add(year)
        return sorted(list(years), reverse=True)
