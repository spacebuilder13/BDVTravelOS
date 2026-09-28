import os
import sys
from pathlib import Path

# Pytest 9 imports test modules without putting the backend root on sys.path.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# server.py reads these at import. Motor does not connect until a query,
# and these tests never query.
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "bdv_travel_os_test")
