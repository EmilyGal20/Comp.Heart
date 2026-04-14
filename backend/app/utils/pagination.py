from math import ceil


DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def normalize_pagination(page: int = DEFAULT_PAGE, page_size: int = DEFAULT_PAGE_SIZE):
    safe_page = max(page or DEFAULT_PAGE, 1)
    safe_page_size = min(max(page_size or DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
    return safe_page, safe_page_size


def paginate_query(query, *, page: int = DEFAULT_PAGE, page_size: int = DEFAULT_PAGE_SIZE):
    safe_page, safe_page_size = normalize_pagination(page, page_size)
    total = query.order_by(None).count()
    items = query.offset((safe_page - 1) * safe_page_size).limit(safe_page_size).all()
    total_pages = ceil(total / safe_page_size) if total else 0
    return {
        "items": items,
        "meta": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": safe_page < total_pages,
            "has_previous": safe_page > 1 and total_pages > 0,
        },
    }


def paginate_list(items: list, *, page: int = DEFAULT_PAGE, page_size: int = DEFAULT_PAGE_SIZE):
    safe_page, safe_page_size = normalize_pagination(page, page_size)
    total = len(items)
    start = (safe_page - 1) * safe_page_size
    end = start + safe_page_size
    page_items = items[start:end]
    total_pages = ceil(total / safe_page_size) if total else 0
    return {
        "items": page_items,
        "meta": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": safe_page < total_pages,
            "has_previous": safe_page > 1 and total_pages > 0,
        },
    }
