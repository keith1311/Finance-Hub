from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Your connection URL (remember to swap in your real password)
DATABASE_URL = "postgresql://postgres:1234@localhost:5432/finance_hub"

# 2. The engine connects Python to PostgreSQL
engine = create_engine(DATABASE_URL)

# 3. The SessionLocal is a factory that creates "sessions" to talk to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base is the parent class your database models will inherit from later
Base = declarative_base()
