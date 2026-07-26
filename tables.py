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


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True)
    user_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    password = Column(String)
    profile_picture = Column(String)

    # Fixed: Match relationship target name and back_populates string
    wallets = relationship(
        "Wallet", back_populates="user", cascade="all, delete-orphan"
    )


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

    # Foreign key pointing to users.user_id (matching Users model)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))

    # Added back-reference to Users
    user = relationship("Users", back_populates="wallets")

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


class Access(Base):
    __tablename__ = "access"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True)


# 1. This tells SQLAlchemy to actually create the "wallets" table in PostgreSQL if it doesn't exist yet
Base.metadata.create_all(bind=engine)
