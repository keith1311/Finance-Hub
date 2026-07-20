from sqlalchemy import UUID, Boolean, Column, DateTime, String, Float
from database import Base, engine
import uuid


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True)
    balance = Column(Float)
    last_used = Column(DateTime)
    password = Column(String)
    censor = Column(Boolean, default=False)
    hide = Column(Boolean, default=False)
    pin = Column(Boolean, default=False)


# 1. This tells SQLAlchemy to actually create the "wallets" table in PostgreSQL if it doesn't exist yet
Base.metadata.create_all(bind=engine)
