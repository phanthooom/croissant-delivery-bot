from __future__ import annotations

import json
import os
import re
import sys
from contextlib import asynccontextmanager
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.request import Request as UrlRequest, urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
REFERENCE_BACKEND_DIR = ROOT_DIR / "reference-backend"
DEMO_DATA_DIR = ROOT_DIR / ".demo-backend"
DEMO_DATA_DIR.mkdir(exist_ok=True)


def bootstrap_env() -> None:
    db_path = DEMO_DATA_DIR / "food-delivery.sqlite3"

    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("APP_DEBUG", "false")
    os.environ.setdefault("APP_SECRET_KEY", "fooddddelivery-demo-secret")
    os.environ.setdefault("APP_ALLOWED_HOSTS", '["*"]')
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "120")
    os.environ.setdefault("TELEGRAM_BOT_TOKEN", "")
    os.environ.setdefault("TELEGRAM_WEBHOOK_URL", "")
    os.environ.setdefault("TELEGRAM_WEBHOOK_SECRET", "")

    sys.path.insert(0, str(REFERENCE_BACKEND_DIR))


bootstrap_env()

from fastapi import APIRouter, FastAPI, Request, status  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.api.v1.endpoints.auth import router as auth_router  # noqa: E402
from app.api.v1.endpoints.cart import router as cart_router  # noqa: E402
from app.api.v1.endpoints.orders import router as orders_router  # noqa: E402
from app.api.v1.endpoints.products import (  # noqa: E402
    category_router,
    product_router,
)
from app.core.config import settings  # noqa: E402
from app.core.exceptions import AppException  # noqa: E402
from app.core.logging import get_logger, setup_logging  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models.models import Base, Category, Product  # noqa: E402


CATALOG_URL = os.getenv("CATALOG_SOURCE_URL", "https://croissant.delever.uz/ru")
logger = get_logger("reference_backend_demo")


@dataclass(slots=True)
class SeedStats:
    categories: int = 0
    products: int = 0


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def pick_localized_value(field: dict[str, str] | None, locale: str) -> str:
    if not isinstance(field, dict):
        return ""

    for key in (locale, "ru", "uz", "en", "kk"):
        candidate = clean_text(field.get(key))
        if candidate:
            return candidate

    for candidate in field.values():
        cleaned = clean_text(candidate)
        if cleaned:
            return cleaned

    return ""


def humanize_slug(value: str | None, fallback: str) -> str:
    slug = clean_text(value)
    if not slug:
        return fallback

    label = slug.replace("-", " ").replace("_", " ").strip()
    return label[:1].upper() + label[1:] if label else fallback


def build_cdn_url(asset_id: str | None) -> str | None:
    asset = clean_text(asset_id)
    if not asset:
        return None
    if asset.startswith("http://") or asset.startswith("https://"):
        return asset
    return f"https://cdn.delever.uz/delever/{asset}"


def extract_json_array(source: str, token: str) -> str:
    token_index = source.find(token)
    if token_index == -1:
        raise RuntimeError("categories token was not found in the source markup")

    array_start = source.find("[", token_index)
    if array_start == -1:
        raise RuntimeError("categories array start was not found in the source markup")

    depth = 0
    in_string = False
    escape_next = False

    for index in range(array_start, len(source)):
        char = source[index]

        if in_string:
            if escape_next:
                escape_next = False
            elif char == "\\":
                escape_next = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char == "[":
            depth += 1
            continue

        if char == "]":
            depth -= 1
            if depth == 0:
                return source[array_start : index + 1]

    raise RuntimeError("categories array end was not found in the source markup")


def load_remote_catalog() -> list[dict[str, Any]]:
    request = UrlRequest(
        CATALOG_URL,
        headers={"User-Agent": "CroissantTelegramMiniApp/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="ignore")

    for script in re.findall(r"<script(?:[^>]*)>([\s\S]*?)</script>", html):
        if "self.__next_f.push" not in script:
            continue
        if '\\"data\\":{\\"categories\\":[' not in script:
            continue

        decoded_script = bytes(script, "utf-8").decode("unicode_escape")
        try:
            decoded_script = decoded_script.encode("latin1").decode("utf-8")
        except UnicodeError:
            pass
        categories_json = extract_json_array(
            decoded_script, '"data":{"categories":'
        )
        return json.loads(categories_json)

    raise RuntimeError("could not find the categories payload in the Croissant source")


async def seed_catalog_if_needed() -> SeedStats:
    async with AsyncSessionLocal() as session:
        existing_products = await session.scalar(select(func.count(Product.id)))
        if existing_products and existing_products > 0:
            existing_categories = await session.scalar(select(func.count(Category.id)))
            return SeedStats(
                categories=int(existing_categories or 0),
                products=int(existing_products),
            )

        raw_categories = load_remote_catalog()
        seen_product_ids: set[str] = set()
        used_category_names: set[str] = set()
        stats = SeedStats()

        for category_index, raw_category in enumerate(raw_categories, start=1):
            if not raw_category.get("active"):
                continue

            raw_products = [
                product
                for product in raw_category.get("products", [])
                if product.get("active") and product.get("active_in_menu")
            ]
            if not raw_products:
                continue

            title_ru = pick_localized_value(raw_category.get("title"), "ru")
            title_uz = pick_localized_value(raw_category.get("title"), "uz")
            fallback_name = f"Category {category_index}"
            display_name = (
                title_ru
                or title_uz
                or humanize_slug(raw_category.get("slug"), fallback_name)
            )

            db_name = display_name
            suffix = 2
            while db_name in used_category_names:
                db_name = f"{display_name} {suffix}"
                suffix += 1
            used_category_names.add(db_name)

            category = Category(
                name=db_name,
                name_ru=title_ru or None,
                name_uz=title_uz or None,
                sort_order=category_index - 1,
                is_active=True,
            )
            session.add(category)
            await session.flush()
            stats.categories += 1

            for product_index, raw_product in enumerate(raw_products, start=1):
                raw_product_id = clean_text(str(raw_product.get("id", "")))
                if not raw_product_id or raw_product_id in seen_product_ids:
                    continue

                seen_product_ids.add(raw_product_id)

                title_ru = pick_localized_value(raw_product.get("title"), "ru")
                title_uz = pick_localized_value(raw_product.get("title"), "uz")
                description_ru = pick_localized_value(
                    raw_product.get("description"), "ru"
                )
                description_uz = pick_localized_value(
                    raw_product.get("description"), "uz"
                )

                fallback_product_name = f"Product {stats.products + 1}"
                display_product_name = (
                    title_ru
                    or title_uz
                    or humanize_slug(raw_product.get("slug"), fallback_product_name)
                )

                session.add(
                    Product(
                        name=display_product_name,
                        name_ru=title_ru or None,
                        name_uz=title_uz or None,
                        description=description_ru or description_uz or None,
                        description_ru=description_ru or None,
                        description_uz=description_uz or None,
                        price=Decimal(str(raw_product.get("out_price") or 0)),
                        image_url=build_cdn_url(raw_product.get("image")),
                        is_active=True,
                        sort_order=product_index - 1,
                        category_id=category.id,
                    )
                )
                stats.products += 1

        await session.commit()
        return stats


async def collect_catalog_stats() -> SeedStats:
    async with AsyncSessionLocal() as session:
        categories = await session.scalar(select(func.count(Category.id)))
        products = await session.scalar(select(func.count(Product.id)))
        return SeedStats(
            categories=int(categories or 0),
            products=int(products or 0),
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    logger.info("demo_backend_starting", database_url=settings.DATABASE_URL)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    stats = await seed_catalog_if_needed()
    logger.info(
        "demo_backend_ready",
        categories=stats.categories,
        products=stats.products,
        catalog_url=CATALOG_URL,
    )

    yield

    await engine.dispose()
    logger.info("demo_backend_shutdown")


def create_demo_app() -> FastAPI:
    app = FastAPI(
        title="Food Delivery Demo Backend",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "type": type(exc).__name__},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    api_router = APIRouter(prefix="/api/v1")
    api_router.include_router(auth_router)
    api_router.include_router(product_router)
    api_router.include_router(category_router)
    api_router.include_router(cart_router)
    api_router.include_router(orders_router)
    app.include_router(api_router)

    @app.get("/health", include_in_schema=False)
    async def health() -> dict[str, Any]:
        stats = await collect_catalog_stats()
        return {
            "status": "ok",
            "version": settings.APP_VERSION,
            "catalog": {
                "categories": stats.categories,
                "products": stats.products,
                "source_url": CATALOG_URL,
            },
        }

    return app


app = create_demo_app()


def main() -> None:
    import uvicorn

    host = os.getenv("REFERENCE_BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("REFERENCE_BACKEND_PORT", "8000"))

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
