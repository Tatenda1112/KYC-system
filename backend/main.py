"""
Shim so you can run from the backend folder:

  uvicorn main:app --reload

The real application is defined in app/main.py.
"""
from app.main import app

__all__ = ["app"]
