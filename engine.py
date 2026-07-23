from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal
from tables import Transactions, Wallet
from datetime import datetime
from sqlalchemy import func, extract
from pydantic import BaseModel


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
        .filter(Wallet.hide == False)
        .order_by(Wallet.pin.desc(), Wallet.last_used.desc())
        .limit(6)
        .all()
    )
    rendered_wallets = []
    for wallet in top_six:
        if wallet.censor == True:
            balance = "******"
        elif wallet.censor == False:
            balance = f"{wallet.balance:.2f}"
        else:
            balance = wallet.balance

        rendered_wallets.append(
            {
                "id": wallet.id,
                "name": wallet.name,
                "balance": balance,
                "password": wallet.password,
                "censor": wallet.censor,
                "pin": wallet.pin,
            }
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

    # Fetch Monthly Total
    # Get current year and month numbers
    current_year = datetime.now().year
    current_month = datetime.now().month

    # Fetch Monthly Total
    monthly_total = (
        db.query(func.sum(Transactions.amount))
        .filter(
            extract("year", Transactions.date) == current_year,
            extract("month", Transactions.date) == current_month,
        )
        .scalar()
    ) or 0.0

    db.close()

    return rendered_wallets, total_balance, transaction_data, canvas_data, monthly_total


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


class RenameWallet(BaseModel):
    walletId: str
    newName: str


@app.post("/api/rename-wallet")
def rename_wallet(data: RenameWallet):
    db = SessionLocal()

    try:
        # 1. Fetch all existing wallet names
        all_wallets = db.query(Wallet).with_entities(Wallet.name).all()
        existing_names = [wallet.name for wallet in all_wallets]

        # 2. Check for duplicates
        if data.newName in existing_names:
            raise HTTPException(
                status_code=400, detail="A wallet with this name already exists."
            )

        # 3. Find the target wallet
        target_wallet = db.query(Wallet).filter(Wallet.id == data.walletId).first()
        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # 4. Update fields
        target_wallet.name = data.newName
        target_wallet.last_used = datetime.now()

        # 5. Commit changes
        db.commit()
        db.refresh(target_wallet)

        return {"status": "No Error", "message": "Wallet renamed successfully"}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly without converting to 500
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/delete-wallet/{wallet_id}")
def delete_wallet(wallet_id: str):
    db = SessionLocal()
    try:
        # 1. Find the wallet matching the wallet_id
        # (Assuming your SQLAlchemy model is named `Wallet` and the primary key or column is `id`)
        wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()

        # 2. Check if the wallet exists
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # 3. Delete the wallet and commit the transaction
        db.delete(wallet)
        db.commit()

        return {"message": "Wallet deleted successfully"}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly without converting to 500
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


class LockWallet(BaseModel):
    walletId: str
    password: str


@app.post("/api/lock-wallet")
def lock_wallet(data: LockWallet):
    db = SessionLocal()
    try:
        target_wallet = db.query(Wallet).filter(Wallet.id == data.walletId).first()

        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        if target_wallet.password == "":
            # Update fields
            target_wallet.password = data.password
            target_wallet.last_used = datetime.now()
        else:
            target_wallet.password = ""
            target_wallet.last_used = datetime.now()

        # Commit changes
        db.commit()
        db.refresh(target_wallet)
        return {"status": "No Error", "message": "Wallet locked successfully"}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly without converting to 500
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/create-wallet/{wallet_name}")
def create_wallet(wallet_name: str):
    db = SessionLocal()
    try:
        existing_wallet = db.query(Wallet).filter(Wallet.name == wallet_name).first()
        if existing_wallet:
            raise HTTPException(
                status_code=400, detail="A wallet with this name already exists."
            )

        # Create the new database record object
        new_wallet = Wallet(
            name=wallet_name,
            balance=0.0,
            last_used=datetime.now(),
            password="",  # Fixed from "'" to an empty string
            censor=False,
            hide=False,
            pin=False,
        )

        # 2. Add the record to the session
        db.add(new_wallet)

        # 3. Commit the transaction to save it to the database
        db.commit()

        # 4. Refresh the instance to get updated fields (like generated IDs)
        db.refresh(new_wallet)

        return {
            "status": "No Error",
            "message": "Wallet created successfully",
        }
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly without converting to 500
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # 5. Always close the session when done
        db.close()


from fastapi import HTTPException


@app.post("/api/{function}/{wallet_id}")
def toggle(function: str, wallet_id: str):
    db = SessionLocal()
    try:
        target_wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()

        if not target_wallet:
            raise HTTPException(status_code=400, detail="Wallet not found")

        if function == "censor":
            target_wallet.censor = not target_wallet.censor
        elif function == "hide":
            target_wallet.hide = not target_wallet.hide
        elif function == "pin":
            target_wallet.pin = not target_wallet.pin
        else:
            raise HTTPException(status_code=400, detail="Invalid action function")

        db.commit()
        return {"success": True, "message": f"Successfully toggled {function}"}

    except HTTPException as he:
        raise he  # Let FastAPI handle 400 properly

    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()
