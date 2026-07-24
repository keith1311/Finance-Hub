from sqlalchemy import (
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Float,
)
from sqlalchemy.orm import relationship
from database import Base, engine
import uuid
from datetime import datetime
from database import SessionLocal


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

    transactions = relationship(
        "Transactions", back_populates="wallet", cascade="all, delete-orphan"
    )


class Transactions(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(DateTime)
    tags = Column(String)
    category = Column(String)
    amount = Column(Float)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id"))
    balance_after = Column(Float)

    wallet = relationship("Wallet", back_populates="transactions")


# 1. This tells SQLAlchemy to actually create the "wallets" table in PostgreSQL if it doesn't exist yet
Base.metadata.create_all(bind=engine)
