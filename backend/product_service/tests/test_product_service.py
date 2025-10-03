import logging
import os
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.product_service.app.db import SessionLocal, engine, get_db
from backend.product_service.app.main import app
from backend.product_service.app.models import Base, Product

# Suppress noisy logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
logging.getLogger("fastapi").setLevel(logging.WARNING)
logging.getLogger("backend.product_service.app.main").setLevel(logging.WARNING)


@pytest.fixture(scope="session", autouse=True)
def setup_database_for_tests():
    max_retries = 10
    retry_delay_seconds = 3
    for i in range(max_retries):
        try:
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError as e:
            time.sleep(retry_delay_seconds)
            if i == max_retries - 1:
                pytest.fail(f"Could not connect to PostgreSQL for Product Service: {e}")
    yield


@pytest.fixture(scope="function")
def db_session_for_test():
    connection = engine.connect()
    transaction = connection.begin()
    db = SessionLocal(bind=connection)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield db
    finally:
        transaction.rollback()
        db.close()
        connection.close()
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="module")
def client():
    os.environ["AZURE_STORAGE_ACCOUNT_NAME"] = "testaccount"
    os.environ["AZURE_STORAGE_ACCOUNT_KEY"] = "testkey"
    os.environ["AZURE_STORAGE_CONTAINER_NAME"] = "test-images"
    os.environ["AZURE_SAS_TOKEN_EXPIRY_HOURS"] = "1"

    with TestClient(app) as test_client:
        yield test_client

    del os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
    del os.environ["AZURE_STORAGE_ACCOUNT_KEY"]
    del os.environ["AZURE_STORAGE_CONTAINER_NAME"]
    del os.environ["AZURE_SAS_TOKEN_EXPIRY_HOURS"]


@pytest.fixture(scope="function", autouse=True)
def mock_azure_blob_storage():
    with patch("backend.product_service.app.main.BlobServiceClient") as mock_blob_service_client:
        mock_instance = MagicMock()
        mock_blob_service_client.return_value = mock_instance

        mock_container_client = MagicMock()
        mock_instance.get_container_client.return_value = mock_container_client
        mock_container_client.create_container.return_value = None

        mock_blob_client = MagicMock()
        mock_instance.get_blob_client.return_value = mock_blob_client
        mock_blob_client.upload_blob.return_value = None
        mock_blob_client.url = (
            "https://testaccount.blob.core.windows.net/test-images/mock_blob.jpg"
        )

        with patch("backend.product_service.app.main.generate_blob_sas") as mock_generate_blob_sas:
            mock_generate_blob_sas.return_value = "mock_sas_token"
            yield mock_blob_service_client


def test_read_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Product Service!"}


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "product-service"}


def test_create_product_success(client: TestClient, db_session_for_test: Session):
    test_data = {
        "name": "New Test Product",
        "description": "A brand new product for testing",
        "price": 12.34,
        "stock_quantity": 100,
        "image_url": "http://example.com/test_image.jpg",
    }
    response = client.post("/products/", json=test_data)

    assert response.status_code == 201
    response_data = response.json()

    assert response_data["name"] == test_data["name"]
    assert response_data["description"] == test_data["description"]
    assert float(response_data["price"]) == test_data["price"]
    assert response_data["stock_quantity"] == test_data["stock_quantity"]
    assert response_data["image_url"] == test_data["image_url"]
    assert "product_id" in response_data


def test_list_products_empty(client: TestClient):
    response = client.get("/products/")
    assert response.status_code == 200
    assert response.json() == []


def test_list_products_with_data(client: TestClient, db_session_for_test: Session):
    product_data = {
        "name": "List Product Example",
        "description": "For list test",
        "price": 5.00,
        "stock_quantity": 10,
        "image_url": "http://example.com/list_test.png",
    }
    client.post("/products/", json=product_data)

    response = client.get("/products/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1


def test_delete_product_success(client: TestClient, db_session_for_test: Session):
    create_resp = client.post(
        "/products/",
        json={
            "name": "Product to Delete",
            "description": "Will be deleted",
            "price": 10.0,
            "stock_quantity": 5,
            "image_url": "http://example.com/to_delete.jpeg",
        },
    )
    product_id = create_resp.json()["product_id"]

    response = client.delete(f"/products/{product_id}")
    assert response.status_code == 204

    get_response = client.get(f"/products/{product_id}")
    assert get_response.status_code == 404
