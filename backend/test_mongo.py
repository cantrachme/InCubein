import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

print("=" * 60)
print("        MongoDB CONNECTION TEST")
print("=" * 60)


def test_mongodb(name, uri):
    print(f"\n[{name}]")
    print("-" * 60)

    if not uri:
        print("❌ URI not found")
        return False

    try:
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=3000,
            socketTimeoutMS=5000,
        )

        # Force connection
        result = client.admin.command("ping")

        print("✅ CONNECTION SUCCESSFUL")
        print(f"Ping: {result}")

        # Server information
        info = client.server_info()

        print(f"MongoDB version: {info.get('version')}")

        # List databases
        databases = client.list_database_names()

        print("\nDatabases:")
        for db in databases:
            print(f"  - {db}")

        client.close()
        return True

    except Exception as e:
        print("❌ CONNECTION FAILED")
        print(f"Error: {e}")

        return False


# ---------------------------------------------------------
# LOCAL MONGODB
# ---------------------------------------------------------

local_uri = os.getenv(
    "LOCAL_MONGODB_URI",
    "mongodb://localhost:27017"
)

local_ok = test_mongodb(
    "LOCAL MONGODB",
    local_uri
)


# ---------------------------------------------------------
# MONGODB ATLAS
# ---------------------------------------------------------

atlas_uri = (
    os.getenv("MONGODB_URI")
    or os.getenv("MONGO_URI")
    or os.getenv("MONGODB_ATLAS_URI")
)

atlas_ok = test_mongodb(
    "MONGODB ATLAS",
    atlas_uri
)


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("                    SUMMARY")
print("=" * 60)

print(
    f"Local MongoDB : {'✅ WORKING' if local_ok else '❌ FAILED'}"
)

print(
    f"MongoDB Atlas : {'✅ WORKING' if atlas_ok else '❌ FAILED'}"
)

print("=" * 60)