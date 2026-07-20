from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal
from tables import Wallet
from datetime import datetime


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
    all_balances = db.query(Wallet).with_entities(Wallet.balance).all()
    total_balance = sum(wallet.balance for wallet in all_balances)
    db.close()
    return rendered_wallets, total_balance


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
