from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv


# 1. Your connection URL (remember to swap in your real password)
load_dotenv()
USER = os.getenv("user")
PASSWORD = os.getenv("dbpassword")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")
DATABASE_URL = (
    f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"
)

# DATABASE_URL = "postgresql://postgres:1234@localhost:5432/finance_hub"

# 2. The engine connects Python to PostgreSQL
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# 3. The SessionLocal is a factory that creates "sessions" to talk to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base is the parent class your database models will inherit from later
Base = declarative_base()
