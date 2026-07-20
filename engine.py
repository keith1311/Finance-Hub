from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal
from tables import Transactions, Wallet
from datetime import datetime
from sqlalchemy import func


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/render_main_page")
def render_main_page():
    db = SessionLocal()
    # Fetch the top 6 wallets based on last_used timestamp
    top_six = (
        db.query(Wallet)
        .with_entities(Wallet.id, Wallet.name, Wallet.balance)
        .order_by(Wallet.last_used.desc())
        .limit(6)
        .all()
    )
    rendered_wallets = []
    for wallet in top_six:
        rendered_wallets.append(
            {"id": wallet.id, "name": wallet.name, "balance": wallet.balance}
        )

    # Calculate total balance across all wallets
    all_balances = db.query(Wallet).with_entities(Wallet.balance).all()
    total_balance = sum(wallet.balance for wallet in all_balances)

    # Fetch transaction data
    raw_transaction_data = (
        db.query(Transactions)
        .join(Wallet, Transactions.wallet_id == Wallet.id)
        .with_entities(
            Transactions.date,
            Transactions.tags,
            Transactions.category,
            Transactions.amount,
            Wallet.name.label("wallet_name"),
        )
        .order_by(Transactions.date.desc())
        .all()
    )

    transaction_data = []
    for tx in raw_transaction_data:
        transaction_data.append(
            {
                "date": tx.date.strftime("%Y-%m-%d"),
                "tags": tx.tags,
                "category": tx.category,
                "amount": tx.amount,
                "wallet_name": tx.wallet_name,
            }
        )

    # Fetch Canvas Data
    raw_canvas_data = (
        db.query(Transactions.category, func.sum(Transactions.amount).label("total"))
        .group_by(Transactions.category)
        .all()
    )

    canvas_data = {
        "labels": [row.category for row in raw_canvas_data],
        "data": [float(row.total) for row in raw_canvas_data],
    }
    db.close()
    return rendered_wallets, total_balance, transaction_data, canvas_data


@app.post("/api/render_wallet_page/{wallet_id}")
def render_wallet_page(wallet_id: str):
    db = SessionLocal()
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()

    if not wallet:
        db.close()
        return {"error": "Wallet not found"}, 404

    wallet.last_used = datetime.now()  # Update last_used timestamp
    db.commit()
    wallet_name = wallet.name
    wallet_balance = wallet.balance
    db.close()
    return {"name": wallet_name, "balance": wallet_balance}
