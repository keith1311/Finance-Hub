from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import SessionLocal, Base, engine
from .tables import Automation, Transactions, Wallet, Users, Access
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, func, extract, or_
from pydantic import BaseModel
import calendar
import jwt
import os
from dotenv import load_dotenv
from passlib.context import CryptContext
from typing import Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uuid

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()

# Register the error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = [
    "http://127.0.0.1:8000",
    "https://finance-hub-sepia-seven.vercel.app",  # Your actual live Vercel domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Set up the hashing context
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"


def recalculate_balance_after(
    wallet_id: str, target_date: date, target_wallet: Wallet, db
):
    # 1. Get the balance of the transaction right before the target date
    previous_tx = (
        db.query(Transactions)
        .filter(
            Transactions.wallet_id == wallet_id,
            Transactions.date < target_date,
        )
        .order_by(Transactions.date.desc(), Transactions.id.desc())
        .first()
    )

    # Set starting balance baseline
    running_balance = float(previous_tx.balance_after) if previous_tx else 0.0

    # 2. Fetch all transactions from the target date forward
    update_transactions = (
        db.query(Transactions)
        .filter(
            Transactions.wallet_id == wallet_id,
            Transactions.date >= target_date,
        )
        .order_by(Transactions.date.asc(), Transactions.id.asc())
        .all()
    )
    # 3. Loop through and recalculate each row sequentially
    last_tx = None

    if not update_transactions:
        # If no transactions are left on/after target_date,
        # the wallet balance should revert to the previous transaction's balance (or 0.0)
        if target_wallet:
            target_wallet.balance = running_balance
    else:
        # Loop through and recalculate each row sequentially
        for tx in update_transactions:
            amount = float(tx.amount) if tx.amount else 0.0

            if tx.category == "Income" or tx.category == "Transfer In":
                running_balance += amount
            else:
                running_balance -= amount

            tx.balance_after = running_balance
            last_tx = tx

        # 4. Update the main wallet's total balance using the absolute latest transaction
        if target_wallet and last_tx:
            target_wallet.balance = last_tx.balance_after
    return


def create_access_token(data: dict):
    encoded_jwt = jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_access_token(token: str):
    try:
        # Decode the token using your secret key and algorithm
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract the user ID (or whatever data you packed into "sub")
        user_id: str = payload.get("id")

        if user_id is None:
            raise HTTPException(
                status_code=401, detail="Failed to validate credentials."
            )

        return user_id

    except jwt.PyJWTError:
        # Triggers if the token is tampered with, fake, or invalid
        raise HTTPException(status_code=401, detail="Failed to validate credentials.")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def serialize_wallet(wallet: Wallet):
    if wallet.censor == True:
        balance = "******"
    elif wallet.censor == False:
        balance = f"{wallet.balance:.2f}"
    else:
        balance = wallet.balance

    return {
        "id": wallet.id,
        "name": wallet.name,
        "balance": balance,
        "password": wallet.password,
        "censor": wallet.censor,
        "pin": wallet.pin,
        "hide": wallet.hide,
    }


@app.on_event("startup")
def startup_event():
    # This safely runs after the app starts up and network is ready
    Base.metadata.create_all(bind=engine)


@app.post("/api/render_main_page")
def render_main_page(authorization: str = Header(None)):
    # 1. Verify the token to get the user_id
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    db = SessionLocal()
    try:
        user_id = verify_access_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")
        # Fetch the top 6 wallets based on last_used timestamp
        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
            .order_by(Wallet.pin.desc(), Wallet.last_used.desc())
            .limit(6)
            .all()
        )
        rendered_wallets = [serialize_wallet(wallet) for wallet in top_six]

        # Calculate total balance across all wallets
        all_balances = (
            db.query(Wallet)
            .with_entities(Wallet.balance)
            .filter(Wallet.user_id == user_id)
            .all()
        )
        total_balance = sum(wallet.balance for wallet in all_balances)

        # Fetch transaction data
        raw_transaction_data = (
            db.query(Transactions)
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(Wallet.user_id == user_id)
            .with_entities(
                Transactions.date,
                Transactions.tags,
                Transactions.category,
                Transactions.amount,
                Wallet.name.label("wallet_name"),
            )
            .order_by(Transactions.date.desc(), Transactions.id.desc())
            .limit(100)
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
        current_day = date.today()
        start_of_day = datetime.combine(
            current_day, datetime.min.time()
        )  # 2026-07-31 00:00:00
        end_of_day = start_of_day + timedelta(days=1)  # 2026-08-01 00:00:00
        current_year = current_day.year
        current_month = current_day.month

        # Find the start of the week (Monday)
        start_of_week = current_day - timedelta(days=current_day.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        # --- 1. DAILY DATA ---
        raw_daily_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date >= start_of_day,
                Transactions.date < end_of_day,
            )
            .group_by(Transactions.category)
            .all()
        )
        daily_total = (
            db.query(func.sum(Transactions.amount))
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date >= start_of_day,
                Transactions.date < end_of_day,
                Wallet.user_id == user_id,
            )
            .scalar()
        ) or 0.0

        daily_data = {
            "labels": [row.category for row in raw_daily_data],
            "data": [float(row.total) for row in raw_daily_data],
        }

        # --- 2. WEEKLY DATA ---
        raw_weekly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date.between(start_of_week, end_of_week),
            )
            .group_by(Transactions.category)
            .all()
        )
        weekly_total = (
            db.query(func.sum(Transactions.amount))
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date.between(start_of_week, end_of_week),
                Wallet.user_id == user_id,
            )
            .scalar()
        ) or 0.0

        weekly_data = {
            "labels": [row.category for row in raw_weekly_data],
            "data": [float(row.total) for row in raw_weekly_data],
        }

        # --- 3. MONTHLY DATA ---
        raw_monthly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
                extract("month", Transactions.date) == current_month,
            )
            .group_by(Transactions.category)
            .all()
        )
        monthly_total = (
            db.query(func.sum(Transactions.amount))
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
                extract("month", Transactions.date) == current_month,
            )
            .scalar()
        ) or 0.0

        monthly_data = {
            "labels": [row.category for row in raw_monthly_data],
            "data": [float(row.total) for row in raw_monthly_data],
        }

        # --- 4. YEARLY DATA ---
        raw_yearly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
            )
            .group_by(Transactions.category)
            .all()
        )
        yearly_total = (
            db.query(func.sum(Transactions.amount))
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(
                Wallet.user_id == user_id,
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
            )
            .scalar()
        ) or 0.0

        yearly_data = {
            "labels": [row.category for row in raw_yearly_data],
            "data": [float(row.total) for row in raw_yearly_data],
        }

        return (
            rendered_wallets,
            total_balance,
            transaction_data,
            daily_data,
            daily_total,
            weekly_data,
            weekly_total,
            monthly_data,
            monthly_total,
            yearly_data,
            yearly_total,
        )

    except HTTPException as he:
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@app.post("/api/render_wallet_page/{wallet_id}")
def render_wallet_page(wallet_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        # Find Wallet
        wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()

        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # Update Last_Used
        wallet.last_used = datetime.now()
        db.commit()

        # Get Wallet Name And Balance
        wallet_data = {
            "name": wallet.name,
            "balance": float(wallet.balance) if wallet.balance is not None else 0.0,
        }

        # Fetch transaction data
        raw_transaction_data = (
            db.query(Transactions)
            .filter(Transactions.wallet_id == wallet_id)
            .with_entities(
                Transactions.id,
                Transactions.date,
                Transactions.tags,
                Transactions.category,
                Transactions.amount,
                Transactions.balance_after,
            )
            .order_by(Transactions.date.desc(), Transactions.id.desc())
            .limit(100)
            .all()
        )

        transaction_data = [
            {
                "id": tx.id,
                "date": tx.date.strftime("%Y-%m-%d") if tx.date else None,
                "tags": tx.tags,
                "category": tx.category,
                "amount": float(tx.amount) if tx.amount is not None else 0.0,
                "balance": float(tx.balance_after)
                if tx.balance_after is not None
                else 0.0,
            }
            for tx in raw_transaction_data
        ]

        # Time References
        current_day = date.today()
        current_year = current_day.year
        current_month = current_day.month
        start_of_day = datetime.combine(
            current_day, datetime.min.time()
        )  # 2026-07-31 00:00:00
        end_of_day = start_of_day + timedelta(days=1)  # 2026-08-01 00:00:00

        start_of_week = current_day - timedelta(days=current_day.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        # --- 1. DAILY DATA ---

        raw_daily_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date >= start_of_day,
                Transactions.date < end_of_day,
                Transactions.wallet_id == wallet_id,
            )
            .group_by(Transactions.category)
            .all()
        )
        daily_total = (
            db.query(func.sum(Transactions.amount))
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date >= start_of_day,
                Transactions.date < end_of_day,
                Transactions.wallet_id == wallet_id,
            )
            .scalar()
        ) or 0.0

        daily_data = {
            "labels": [row.category for row in raw_daily_data],
            "data": [float(row.total) for row in raw_daily_data],
        }

        # --- 2. WEEKLY DATA ---

        raw_weekly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.date.between(start_of_week, end_of_week),
                Transactions.wallet_id == wallet_id,
            )
            .group_by(Transactions.category)
            .all()
        )
        weekly_total = (
            db.query(func.sum(Transactions.amount))
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.wallet_id == wallet_id,
                Transactions.date.between(start_of_week, end_of_week),
            )
            .scalar()
        ) or 0.0

        weekly_data = {
            "labels": [row.category for row in raw_weekly_data],
            "data": [float(row.total) for row in raw_weekly_data],
        }

        # --- 3. MONTHLY DATA ---

        raw_monthly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.wallet_id == wallet_id,
                extract("year", Transactions.date) == current_year,
                extract("month", Transactions.date) == current_month,
            )
            .group_by(Transactions.category)
            .all()
        )
        monthly_total = (
            db.query(func.sum(Transactions.amount))
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                Transactions.wallet_id == wallet_id,
                extract("year", Transactions.date) == current_year,
                extract("month", Transactions.date) == current_month,
            )
            .scalar()
        ) or 0.0

        monthly_data = {
            "labels": [row.category for row in raw_monthly_data],
            "data": [float(row.total) for row in raw_monthly_data],
        }

        # --- 4. YEARLY DATA ---

        raw_yearly_data = (
            db.query(
                Transactions.category, func.sum(Transactions.amount).label("total")
            )
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
                Transactions.wallet_id == wallet_id,
            )
            .group_by(Transactions.category)
            .all()
        )
        yearly_total = (
            db.query(func.sum(Transactions.amount))
            .filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
                extract("year", Transactions.date) == current_year,
                Transactions.wallet_id == wallet_id,
            )
            .scalar()
        ) or 0.0

        yearly_data = {
            "labels": [row.category for row in raw_yearly_data],
            "data": [float(row.total) for row in raw_yearly_data],
        }

        # ==========================================
        # LINE CHART DATASETS & TIME PERIOD STRUCTURES
        # ==========================================
        def calculate_comparison(current_val, previous_val):
            if previous_val == 0:
                # Changed -100.0 to 100.0 (or absolute) so the value is never negative
                percentage = (
                    100.0 if current_val > 0 else (0.0 if current_val == 0 else 100.0)
                )
                nature = (
                    "Positive"
                    if current_val > 0
                    else ("Negative" if current_val < 0 else "Neutral")
                )
            else:
                raw_percentage = (
                    (current_val - previous_val) / abs(previous_val)
                ) * 100
                percentage = round(abs(raw_percentage), 2)

                if raw_percentage > 0:
                    nature = "Positive"
                elif raw_percentage < 0:
                    nature = "Negative"
                else:
                    nature = "Neutral"

            return percentage, nature

        # 1. DAILY LINE DATA
        last_day_of_month = calendar.monthrange(current_year, current_month)[1]
        days_in_month = list(range(1, last_day_of_month + 1))
        day_labels = [str(d) for d in days_in_month]

        def fetch_daily_line_data(category_condition):
            raw_data = (
                db.query(
                    extract("day", Transactions.date).label("day"),
                    func.sum(Transactions.amount).label("total"),
                )
                .filter(
                    Transactions.wallet_id == wallet_id,
                    category_condition,
                    extract("year", Transactions.date) == current_year,
                    extract("month", Transactions.date) == current_month,
                )
                .group_by(extract("day", Transactions.date))
                .all()
            )
            data_dict = {int(row.day): float(row.total) for row in raw_data}
            return [data_dict.get(d, 0.0) for d in days_in_month]

        daily_expense = fetch_daily_line_data(
            and_(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
            )
        )
        daily_income = fetch_daily_line_data(
            or_(
                Transactions.category == "Income",
                Transactions.category == "Transfer In",
            )
        )
        daily_savings = [
            round(inc - exp, 2) for inc, exp in zip(daily_income, daily_expense)
        ]

        daily_expense_data = {"labels": day_labels, "data": daily_expense}
        daily_income_data = {"labels": day_labels, "data": daily_income}
        daily_savings_data = {"labels": day_labels, "data": daily_savings}

        day_number = current_day.day
        today_index = (
            days_in_month.index(day_number)
            if day_number in days_in_month
            else len(days_in_month) - 1
        )
        previous_index = max(0, today_index - 1)

        curr_inc = daily_income[today_index]
        prev_inc = daily_income[previous_index]
        daily_income_num, daily_income_nature = calculate_comparison(curr_inc, prev_inc)

        curr_exp = daily_expense[today_index]
        prev_exp = daily_expense[previous_index]
        daily_expense_num, daily_expense_nature = calculate_comparison(
            curr_exp, prev_exp
        )

        curr_sav = daily_savings[today_index]
        prev_sav = daily_savings[previous_index]
        daily_savings_num, daily_savings_nature = calculate_comparison(
            curr_sav, prev_sav
        )

        # 3. Final Output Arrays for UI Display
        dailyNumber = [daily_income_num, daily_expense_num, daily_savings_num]
        dailyNature = [daily_income_nature, daily_expense_nature, daily_savings_nature]

        # 2. WEEKLY LINE DATA (Universal Python-calculated ISO week fallback)
        weeks_in_year = list(range(1, 53))
        week_labels = [f"Week {w}" for w in weeks_in_year]

        def fetch_weekly_line_data(category_condition):
            raw_data = (
                db.query(Transactions.date, Transactions.amount)
                .filter(
                    Transactions.wallet_id == wallet_id,
                    category_condition,
                    extract("year", Transactions.date) == current_year,
                )
                .all()
            )
            data_dict = {w: 0.0 for w in weeks_in_year}
            for row in raw_data:
                if row.date:
                    week_num = row.date.isocalendar()[1]
                    if week_num in data_dict:
                        data_dict[week_num] += float(row.amount)
            return [data_dict[w] for w in weeks_in_year]

        weekly_expense = fetch_weekly_line_data(
            and_(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
            )
        )
        weekly_income = fetch_weekly_line_data(
            or_(
                Transactions.category == "Income",
                Transactions.category == "Transfer In",
            )
        )
        weekly_savings = [
            round(inc - exp, 2) for inc, exp in zip(weekly_income, weekly_expense)
        ]

        weekly_expense_data = {"labels": week_labels, "data": weekly_expense}
        weekly_income_data = {"labels": week_labels, "data": weekly_income}
        weekly_savings_data = {"labels": week_labels, "data": weekly_savings}

        week_number = current_day.isocalendar()[1]
        current_week_number = current_day.isocalendar()[1]

        current_week_index = (
            weeks_in_year.index(current_week_number)
            if current_week_number in weeks_in_year
            else len(weeks_in_year) - 1
        )

        previous_week_index = max(0, current_week_index - 1)

        # 1. Extract Current Week and Previous Week values from your weekly lists
        curr_inc = weekly_income[current_week_index]
        prev_inc = weekly_income[previous_week_index]
        weekly_income_num, weekly_income_nature = calculate_comparison(
            curr_inc, prev_inc
        )

        curr_exp = weekly_expense[current_week_index]
        prev_exp = weekly_expense[previous_week_index]
        weekly_expense_num, weekly_expense_nature = calculate_comparison(
            curr_exp, prev_exp
        )

        curr_sav = weekly_savings[current_week_index]
        prev_sav = weekly_savings[previous_week_index]
        weekly_savings_num, weekly_savings_nature = calculate_comparison(
            curr_sav, prev_sav
        )

        # 2. Final Output Arrays for UI Display (Weekly)
        weeklyNumber = [weekly_income_num, weekly_expense_num, weekly_savings_num]
        weeklyNature = [
            weekly_income_nature,
            weekly_expense_nature,
            weekly_savings_nature,
        ]

        # 3. MONTHLY LINE DATA
        all_months = list(range(1, 13))
        month_labels = [calendar.month_name[m] for m in all_months]

        def fetch_monthly_line_data(category_condition):
            raw_data = (
                db.query(
                    extract("month", Transactions.date).label("month"),
                    func.sum(Transactions.amount).label("total"),
                )
                .filter(
                    Transactions.wallet_id == wallet_id,
                    category_condition,
                    extract("year", Transactions.date) == current_year,
                )
                .group_by(extract("month", Transactions.date))
                .all()
            )
            data_dict = {int(row.month): float(row.total) for row in raw_data}
            return [data_dict.get(m, 0.0) for m in all_months]

        monthly_expense = fetch_monthly_line_data(
            and_(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
            )
        )
        monthly_income = fetch_monthly_line_data(
            or_(
                Transactions.category == "Income",
                Transactions.category == "Transfer In",
            )
        )
        monthly_savings = [
            round(inc - exp, 2) for inc, exp in zip(monthly_income, monthly_expense)
        ]

        monthly_expense_data = {"labels": month_labels, "data": monthly_expense}
        monthly_income_data = {"labels": month_labels, "data": monthly_income}
        monthly_savings_data = {"labels": month_labels, "data": monthly_savings}

        current_month_number = current_day.month

        # Find today's month index in the list
        current_month_index = (
            all_months.index(current_month_number)
            if current_month_number in all_months
            else len(all_months) - 1
        )

        # Find the previous month's index safely
        previous_month_index = max(0, current_month_index - 1)

        # Extract Current Month and Previous Month values from your monthly lists
        curr_inc = monthly_income[current_month_index]
        prev_inc = monthly_income[previous_month_index]
        monthly_income_num, monthly_income_nature = calculate_comparison(
            curr_inc, prev_inc
        )

        curr_exp = monthly_expense[current_month_index]
        prev_exp = monthly_expense[previous_month_index]
        monthly_expense_num, monthly_expense_nature = calculate_comparison(
            curr_exp, prev_exp
        )

        curr_sav = monthly_savings[current_month_index]
        prev_sav = monthly_savings[previous_month_index]
        monthly_savings_num, monthly_savings_nature = calculate_comparison(
            curr_sav, prev_sav
        )

        # Final Output Arrays for UI Display (Monthly)
        monthlyNumber = [monthly_income_num, monthly_expense_num, monthly_savings_num]
        monthlyNature = [
            monthly_income_nature,
            monthly_expense_nature,
            monthly_savings_nature,
        ]

        # 4. YEARLY LINE DATA
        start_decade = (current_year // 10) * 10
        decade_years = list(range(start_decade, start_decade + 10))
        year_labels = [str(y) for y in decade_years]

        def fetch_yearly_line_data(category_condition):
            raw_data = (
                db.query(
                    extract("year", Transactions.date).label("year"),
                    func.sum(Transactions.amount).label("total"),
                )
                .filter(
                    Transactions.wallet_id == wallet_id,
                    category_condition,
                    extract("year", Transactions.date).between(
                        start_decade, start_decade + 9
                    ),
                )
                .group_by(extract("year", Transactions.date))
                .all()
            )
            data_dict = {int(row.year): float(row.total) for row in raw_data}
            return [data_dict.get(y, 0.0) for y in decade_years]

        yearly_expense = fetch_yearly_line_data(
            and_(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
            )
        )
        yearly_income = fetch_yearly_line_data(
            or_(
                Transactions.category == "Income",
                Transactions.category == "Transfer In",
            )
        )
        yearly_savings = [
            round(inc - exp, 2) for inc, exp in zip(yearly_income, yearly_expense)
        ]

        yearly_expense_data = {"labels": year_labels, "data": yearly_expense}
        yearly_income_data = {"labels": year_labels, "data": yearly_income}
        yearly_savings_data = {"labels": year_labels, "data": yearly_savings}

        current_year_number = current_day.year

        # Find the current year's index inside this decade block
        current_decade_index = (
            decade_years.index(current_year_number)
            if current_year_number in decade_years
            else len(decade_years) - 1
        )

        # Find the previous year's index safely within the decade list
        previous_decade_index = max(0, current_decade_index - 1)
        # Extract Current and Previous values from your yearly lists using the decade indexes
        curr_inc = yearly_income[current_decade_index]
        prev_inc = yearly_income[previous_decade_index]
        decade_income_num, decade_income_nature = calculate_comparison(
            curr_inc, prev_inc
        )

        curr_exp = yearly_expense[current_decade_index]
        prev_exp = yearly_expense[previous_decade_index]
        decade_expense_num, decade_expense_nature = calculate_comparison(
            curr_exp, prev_exp
        )

        curr_sav = yearly_savings[current_decade_index]
        prev_sav = yearly_savings[previous_decade_index]
        decade_savings_num, decade_savings_nature = calculate_comparison(
            curr_sav, prev_sav
        )

        # Final Output Arrays for UI Display (Decade/Yearly view)
        yearlyNumber = [decade_income_num, decade_expense_num, decade_savings_num]
        yearlyNature = [
            decade_income_nature,
            decade_expense_nature,
            decade_savings_nature,
        ]

        # Return all structured datasets and values
        return [
            wallet_data,
            transaction_data,
            # Daily
            daily_data,
            daily_expense_data,
            daily_income_data,
            daily_savings_data,
            daily_total,
            # Weekly
            weekly_data,
            weekly_expense_data,
            weekly_income_data,
            weekly_savings_data,
            weekly_total,
            # Monthly
            monthly_data,
            monthly_expense_data,
            monthly_income_data,
            monthly_savings_data,
            monthly_total,
            # Yearly
            yearly_data,
            yearly_expense_data,
            yearly_income_data,
            yearly_savings_data,
            yearly_total,
            # Percentage
            dailyNumber,
            dailyNature,
            weeklyNumber,
            weeklyNature,
            monthlyNumber,
            monthlyNature,
            yearlyNumber,
            yearlyNature,
        ]

    finally:
        db.close()


class RenameWallet(BaseModel):
    walletId: str
    newName: str


@app.post("/api/rename-wallet")
def rename_wallet(data: RenameWallet, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        # 1. Fetch all existing wallet names
        all_wallets = (
            db.query(Wallet)
            .with_entities(Wallet.name)
            .filter(Wallet.user_id == user_id)
            .all()
        )
        existing_names = [wallet.name for wallet in all_wallets]

        # 2. Check for duplicates
        if data.newName in existing_names:
            raise HTTPException(
                status_code=400, detail="A wallet with this name already exists."
            )

        # 3. Find the target wallet
        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.walletId, Wallet.user_id == user_id)
            .first()
        )
        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # 4. Update fields
        target_wallet.name = data.newName
        target_wallet.last_used = datetime.now()

        # 5. Commit changes
        db.commit()
        db.refresh(target_wallet)

        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
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
                    "hide": wallet.hide,
                    "pin": wallet.pin,
                }
            )

        return {"wallets": rendered_wallets}

    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/delete-wallet/{wallet_id}")
def delete_wallet(wallet_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")
    db = SessionLocal()
    try:
        # 1. Find the wallet matching the wallet_id
        wallet = (
            db.query(Wallet)
            .filter(Wallet.id == wallet_id, Wallet.user_id == user_id)
            .first()
        )

        # 2. Check if the wallet exists
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # 3. Delete the wallet and commit the transaction
        db.delete(wallet)
        db.commit()

        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
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
                    "hide": wallet.hide,
                    "pin": wallet.pin,
                }
            )

        return {"wallets": rendered_wallets}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class LockWallet(BaseModel):
    walletId: str
    password: str
    token: str


@app.post("/api/lock-wallet")
def lock_wallet(data: LockWallet, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.walletId, Wallet.user_id == user_id)
            .first()
        )

        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        if target_wallet.password == "":
            target_wallet.password = data.password
            target_wallet.last_used = datetime.now()
        else:
            target_wallet.password = ""
            target_wallet.last_used = datetime.now()

        # Commit changes
        db.commit()
        db.refresh(target_wallet)

        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
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
                    "hide": wallet.hide,
                    "pin": wallet.pin,
                }
            )

        return {"wallets": rendered_wallets}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.post("/api/create-wallet/{wallet_name}")
def create_wallet(wallet_name: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        existing_wallet = (
            db.query(Wallet)
            .filter(Wallet.name == wallet_name, Wallet.user_id == user_id)
            .first()
        )
        if existing_wallet:
            raise HTTPException(
                status_code=400, detail="A wallet with this name already exists."
            )

        # Create the new database record object
        new_wallet = Wallet(
            name=wallet_name,
            balance=0.0,
            last_used=datetime.now(),
            password="",
            censor=False,
            hide=False,
            pin=False,
            user_id=user_id,
        )

        # 2. Add the record to the session
        db.add(new_wallet)

        # 3. Commit the transaction to save it to the database
        db.commit()

        # 4. Refresh the instance to get updated fields (like generated IDs)
        db.refresh(new_wallet)

        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
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
                    "hide": wallet.hide,
                    "pin": wallet.pin,
                }
            )

        return {"wallets": rendered_wallets}
    except HTTPException as he:
        raise he  # Let FastAPI handle 400, 404, etc. properly
    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class toggle(BaseModel):
    wallet_id: str


@app.post("/api/toggle/{function}")
def toggle_wallet(function: str, data: toggle, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.wallet_id, Wallet.user_id == user_id)
            .first()
        )

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

        target_wallet.last_used = datetime.now()
        db.commit()

        top_six = (
            db.query(Wallet)
            .filter(Wallet.hide == False, Wallet.user_id == user_id)
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
                    "hide": wallet.hide,
                    "pin": wallet.pin,
                }
            )

        return {"wallets": rendered_wallets}

    except HTTPException as he:
        raise he  # Let FastAPI handle 400 properly

    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


class RegisterLogin(BaseModel):
    email: str
    password: str


@app.post("/api/register")
@limiter.limit("5/minute")
def Register(request: Request, data: RegisterLogin):
    db = SessionLocal()
    try:
        allowed_entry = db.query(Access).filter(Access.email == data.email).first()
        if not allowed_entry:
            raise HTTPException(status_code=403, detail="Email access denied.")

        existing_user = db.query(Users).filter(Users.email == data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User already registered.")

        hashed_password = hash_password(data.password)

        new_user = Users(
            email=data.email,
            password=hashed_password,
            profile_picture="default_pfp.jpg",
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        access_token = create_access_token(data={"id": str(new_user.user_id)})
        return {
            "access_token": access_token,
            "token_type": "bearer",  # 👈 Just an informational label for the frontend
        }

    except HTTPException as he:
        raise he  # Let FastAPI handle 400 properly

    except Exception as e:
        db.rollback()  # Undo changes if something unexpected fails
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@app.post("/api/login")
@limiter.limit("5/minute")
def Login(request: Request, data: RegisterLogin):
    db = SessionLocal()
    try:
        existing_user = db.query(Users).filter(Users.email == data.email).first()
        if not existing_user:
            raise HTTPException(status_code=400, detail="User not found.")

        # Verify the password hash
        if not verify_password(data.password, existing_user.password):
            raise HTTPException(
                status_code=401, detail="Incorrect password. Please try again."
            )

        # Create the token payload and generate the token
        access_token = create_access_token(data={"id": str(existing_user.user_id)})

        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException as he:
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@app.post("/api/render-settings")
def render_settings(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]

    user_id = verify_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # 4. Return the gathered data
        return {
            "email": user.email,
            "profile_picture": user.profile_picture,
        }

    except HTTPException as he:
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


class AddIncome(BaseModel):
    date: date
    tag: str
    amount: float
    wallet_id: str


@app.post("/api/add-income")
def add_income(data: AddIncome, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.wallet_id, Wallet.user_id == user_id)
            .first()
        )
        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found.")

        # 2. Check the latest existing transaction date FIRST (before adding the new one)
        latest_transaction = (
            db.query(Transactions)
            .filter(Transactions.wallet_id == data.wallet_id)
            .order_by(Transactions.date.desc(), Transactions.id.desc())
            .first()
        )

        # If you are returning a dictionary or model, ensure the field is just a date
        formatted_date = data.date.date() if hasattr(data.date, "date") else data.date

        # 3. Create the new transaction object (don't calculate balance_after manually yet)
        new_transaction = Transactions(
            date=formatted_date,
            tags=data.tag,
            category="Income",
            amount=data.amount,
            wallet_id=data.wallet_id,
        )
        db.add(new_transaction)
        db.flush()  # Flushes to give new_transaction an ID without committing yet

        # 4. Branch based on whether it's backdated or the newest entry
        if latest_transaction and latest_transaction.date > data.date:
            # It's backdated! Let the recalculator handle the whole chain safely
            recalculate_balance_after(data.wallet_id, data.date, target_wallet, db)
            db.commit()  # Commit after recalculation
        else:
            # Fast path: It's today or the newest entry
            previous_balance = (
                float(latest_transaction.balance_after) if latest_transaction else 0.0
            )
            new_transaction.balance_after = previous_balance + data.amount
            target_wallet.balance = new_transaction.balance_after
            db.commit()

        db.refresh(new_transaction)
        return {"message": "Income added successfully"}

    except HTTPException as he:
        db.rollback()
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class CreateTransaction(BaseModel):
    date: date
    tag: str
    category: str
    amount: float
    wallet_id: str


@app.post("/api/create-transaction")
def create_transaction(data: CreateTransaction, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.wallet_id, Wallet.user_id == user_id)
            .first()
        )
        if not target_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found.")

        # 2. Check the latest existing transaction date FIRST (before adding the new one)
        latest_transaction = (
            db.query(Transactions)
            .filter(Transactions.wallet_id == data.wallet_id)
            .order_by(Transactions.date.desc(), Transactions.id.desc())
            .first()
        )

        # If you are returning a dictionary or model, ensure the field is just a date
        formatted_date = data.date.date() if hasattr(data.date, "date") else data.date

        # 3. Create the new transaction object
        new_transaction = Transactions(
            date=formatted_date,
            tags=data.tag,
            category=data.category,
            amount=data.amount,
            wallet_id=data.wallet_id,
        )
        db.add(new_transaction)
        db.flush()  # Flushes to get an ID without committing yet

        # 4. Branch based on whether it's backdated or the newest entry
        if latest_transaction and latest_transaction.date > data.date:
            # It's backdated! Let the recalculator handle the whole chain safely
            recalculate_balance_after(data.wallet_id, data.date, target_wallet, db)
            db.commit()  # Commit after recalculation
        else:
            # Fast path: It's today or the newest entry (Always an expense/withdrawal here)
            previous_balance = (
                float(latest_transaction.balance_after) if latest_transaction else 0.0
            )
            new_transaction.balance_after = previous_balance - data.amount
            target_wallet.balance = new_transaction.balance_after
            db.commit()

        db.refresh(new_transaction)
        return {"message": "Transaction created successfully"}

    except HTTPException as he:
        db.rollback()
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class ChangePassword(BaseModel):
    oldPassword: str
    newPassword: str


@app.post("/api/change-password")
def change_password(data: ChangePassword, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        user = db.query(Users).filter(Users.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database.")

        if not verify_password(data.oldPassword, user.password):
            raise HTTPException(
                status_code=400, detail="Incorrect password. Please try again."
            )

        user.password = pwd_context.hash(data.newPassword)
        db.commit()

        return {"message": "Password updated successfully"}

    except HTTPException as he:
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@app.get(
    "/api/render-passwords"
)  # Changed to GET since you are fetching/rendering data
def render_passwords(authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        # Optional: If wallets belong to a specific user, add user_id filter:
        # locked_wallet = db.query(Wallet).filter(Wallet.user_id == user_id, Wallet.password != "").all()
        locked_wallet = (
            db.query(Wallet).filter(Wallet.password != "", Wallet.id == user_id).all()
        )

        # 2. Build the list of dictionaries
        passwords_list = []
        for wallet in locked_wallet:
            passwords_list.append(
                {
                    "name": wallet.name,  # Adjust property name if your column is different (e.g., wallet.wallet_name)
                    "password": wallet.password,  # Or hashed password / hint depending on your schema
                }
            )

        return passwords_list

    except HTTPException as he:
        raise he

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@app.post("/api/load-wallets")
def load_wallets(authorization: str = Header(None)):
    db = SessionLocal()
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        # Fetch the wallets for the authenticated user
        wallets = (
            db.query(Wallet)
            .filter(Wallet.user_id == user_id)
            .order_by(Wallet.pin.desc(), Wallet.last_used.desc())
            .all()
        )

        rendered_wallets = []
        for wallet in wallets:
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
                    "hide": wallet.hide,
                }
            )
        return rendered_wallets

    except HTTPException as he:
        raise he

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


class DeleteTransaction(BaseModel):
    transactionId: str
    walletId: str


@app.post("/api/delete-transaction")
def delete_transaction(data: DeleteTransaction, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")

        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        # Fetch the transaction for the authenticated user
        transaction = (
            db.query(Transactions)
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(Transactions.id == data.transactionId, Wallet.user_id == user_id)
            .first()
        )

        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found.")

        # Track all wallets and dates that need balance recalculation
        wallets_to_recalculate = set()  # Stores tuples of (wallet_id, date)

        # Check if it's a paired transfer transaction
        if transaction.transfer_group_id is not None and transaction.category in [
            "Transfer Out",
            "Transfer In",
        ]:
            transfer_transactions = (
                db.query(Transactions)
                .join(Wallet, Transactions.wallet_id == Wallet.id)
                .filter(
                    Transactions.transfer_group_id == transaction.transfer_group_id,
                    Wallet.user_id == user_id,
                )
                .limit(2)
                .all()
            )

            for transfer_tx in transfer_transactions:
                # Save wallet and date before deleting

                wallets_to_recalculate.add((transfer_tx.wallet_id, transfer_tx.date))
                db.delete(transfer_tx)
        else:
            # Single normal transaction
            wallets_to_recalculate.add((transaction.wallet_id, transaction.date))
            db.delete(transaction)

        db.flush()  # Flush so all deletions are staged

        # Recalculate balances for all affected wallets
        for w_id, t_date in wallets_to_recalculate:
            # Fetch the specific wallet object from db to ensure it's valid
            affected_wallet = db.query(Wallet).filter(Wallet.id == w_id).first()
            if affected_wallet:
                recalculate_balance_after(w_id, t_date, affected_wallet, db)
                print(
                    f"Recalculated balances for wallet {affected_wallet.name} after deleting transaction(s) on {t_date}"
                )

        db.commit()
        return {"message": "Transaction deleted successfully"}

    except HTTPException as he:
        db.rollback()
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


class FilterTransactions(BaseModel):
    row: Optional[int] = None
    date: Optional[str] = None
    tag: Optional[str] = None
    category: Optional[str] = None
    operator: Optional[str] = None  # e.g., "<", "<=", "=", ">=", ">"
    amount: Optional[float] = None  # Coming in as string
    wallet: Optional[str] = None
    balance_after: Optional[str] = None
    wallet_id: Optional[str] = None


@app.post("/api/get-filter/{origin}")
def filter_transactions(
    data: FilterTransactions, origin: str, authorization: str = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]
    user_id = verify_access_token(token=token)
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    db = SessionLocal()
    try:
        # 1. Start the traditional query scoped to the user
        query = (
            db.query(Transactions)
            .join(Wallet, Transactions.wallet_id == Wallet.id)
            .filter(Wallet.user_id == user_id)
            .with_entities(
                Transactions.date,
                Transactions.tags,
                Transactions.category,
                Transactions.amount,
                Transactions.balance_after,
                Wallet.name.label("wallet_name"),
            )
        )

        # 2. Conditionally stack filters using .filter()

        if data.wallet_id is not None:
            query = query.filter(Transactions.wallet_id == data.wallet_id)

        if data.date is not None:
            query = query.filter(Transactions.date == data.date)

        if data.tag is not None and data.tag.strip() != "":
            # Split by comma, clean up each tag's spaces
            tag_list = [t.strip() for t in data.tag.split(",") if t.strip()]

            if tag_list:
                # Build an OR condition: matches tag1 OR tag2 OR tag3...
                tag_conditions = [Transactions.tags.ilike(f"%{t}%") for t in tag_list]
                query = query.filter(or_(*tag_conditions))

        if data.category is not None and data.category != "Expense":
            query = query.filter(Transactions.category.ilike(f"%{data.category}%"))

        if data.category is not None and data.category == "Expense":
            query = query.filter(
                Transactions.category != "Income",
                Transactions.category != "Transfer In",
            )

        if data.wallet is not None:
            query = query.filter(Wallet.name == data.wallet)

        # 3. Handle stringified amount and symbol operators
        if data.amount is not None:
            try:
                numeric_amount = float(data.amount)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400, detail="Amount must be a valid number."
                )

            op = data.operator if data.operator else "="

            if op == "=":
                query = query.filter(Transactions.amount == numeric_amount)
            elif op == ">":
                query = query.filter(Transactions.amount > numeric_amount)
            elif op == ">=":
                query = query.filter(Transactions.amount >= numeric_amount)
            elif op == "<":
                query = query.filter(Transactions.amount < numeric_amount)
            elif op == "<=":
                query = query.filter(Transactions.amount <= numeric_amount)
            else:
                raise HTTPException(status_code=400, detail=f"Invalid operator: {op}")

        if data.balance_after is not None:
            query = query.filter(Transactions.balance_after == data.balance_after)

        query = query.order_by(Transactions.date.desc(), Transactions.id.desc())

        if data.row is not None:
            query = query.limit(data.row)

        # 4. Fetch final results
        results = query.all()

        transaction_data = []
        row_counter = 0  # Initialize row counter
        total = 0.0
        if origin == "main":
            for tx in results:
                if tx.category == "Income" or tx.category == "Transfer In":
                    total += tx.amount
                else:
                    total -= tx.amount
                row_counter += 1
                transaction_data.append(
                    {
                        "index": row_counter,
                        "date": tx.date.strftime("%Y-%m-%d"),
                        "tags": tx.tags,
                        "category": tx.category,
                        "amount": tx.amount,
                        "wallet_name": tx.wallet_name,
                    }
                )
        elif origin == "wallet":
            for tx in results:
                if tx.category == "Income" or tx.category == "Transfer In":
                    total += tx.amount
                else:
                    total -= tx.amount
                row_counter += 1
                transaction_data.append(
                    {
                        "index": row_counter,
                        "date": tx.date.strftime("%Y-%m-%d"),
                        "tags": tx.tags,
                        "category": tx.category,
                        "amount": tx.amount,
                        "balance": tx.balance_after,
                    }
                )
        return (transaction_data, row_counter, total)

    finally:
        db.close()


class WhiteList(BaseModel):
    email: str


@app.post("/api/whitelist-email")
def whitelist(data: WhiteList, authorization: str = Header(None)):
    # Optional: Add your token verification here if needed
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid request.")

    token = authorization.split(" ")[1]
    user_id = verify_access_token(token=token)

    if not user_id:
        raise HTTPException(status_code=401, detail="User not found.")

    if user_id != "6dc6905e-1485-4133-a977-85833dea270d":
        raise HTTPException(
            status_code=403,
            detail="You do not have the authority to whitelist another user.",
        )

    db = SessionLocal()
    try:
        # 1. Query for the specific email instead of loading all rows
        existing_user = db.query(Access).filter(Access.email == data.email).first()

        if existing_user:
            raise HTTPException(status_code=400, detail="Email already whitelisted.")

        # 2. Instantiate the Access model object (not a raw dictionary)
        new_entry = Access(email=data.email)

        db.add(new_entry)
        db.commit()
        db.refresh(new_entry)

        return {"message": "Email successfully whitelisted."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class EditTransaction(BaseModel):
    transactionId: str
    date: date
    tag: str
    category: str
    amount: float
    walletId: str


@app.post("/api/edit-transaction")
def edit_transaction(data: EditTransaction, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)

        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        transaction = (
            db.query(Transactions).filter(Transactions.id == data.transactionId).first()
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found.")

        # 3. Update the transaction
        transaction.date = data.date
        transaction.tags = data.tag
        transaction.category = data.category
        transaction.amount = data.amount

        target_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.walletId, Wallet.user_id == user_id)
            .first()
        )

        # Slow path: It's an older/backdated deletion, ripple the math forward
        recalculate_balance_after(data.walletId, data.date, target_wallet, db)

        db.commit()
        db.refresh(transaction)
        return {"message": "Transaction updated successfully."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class TransferMoney(BaseModel):
    date: date
    amount: float
    from_wallet_id: str
    to_wallet: str


@app.post("/api/transfer-money")
def transfer_money(data: TransferMoney, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)

        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        from_wallet = (
            db.query(Wallet)
            .filter(Wallet.id == data.from_wallet_id, Wallet.user_id == user_id)
            .first()
        )
        to_wallet = (
            db.query(Wallet)
            .filter(Wallet.name == data.to_wallet, Wallet.user_id == user_id)
            .first()
        )

        if not from_wallet or not to_wallet:
            raise HTTPException(status_code=404, detail="Wallet not found.")

        if from_wallet.id == to_wallet.id:
            raise HTTPException(
                status_code=400, detail="Cannot transfer money to the same wallet."
            )

        # Create two transactions: one for the source wallet and one for the destination wallet

        group_id = uuid.uuid4()

        transfer_out = Transactions(
            date=data.date,
            tags=f"Transfer to {to_wallet.name}",
            category="Transfer Out",
            amount=data.amount,
            wallet_id=data.from_wallet_id,
            transfer_group_id=group_id,
        )
        transfer_in = Transactions(
            date=data.date,
            tags=f"Transfer from {from_wallet.name}",
            category="Transfer In",
            amount=data.amount,
            wallet_id=to_wallet.id,
            transfer_group_id=group_id,
        )
        db.add(transfer_out)
        db.add(transfer_in)
        db.flush()  # Flush to get IDs without committing yet

        # Recalculate balances for both wallets
        recalculate_balance_after(data.from_wallet_id, data.date, from_wallet, db)
        recalculate_balance_after(to_wallet.id, data.date, to_wallet, db)

        db.commit()
        return {"message": "Transfer completed successfully."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class RenderAutomation(BaseModel):
    wallet_id: str


@app.post("/api/render-automation")
def render_automation(data: RenderAutomation, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        # 2. Fetch automation settings for the specified wallet
        all_automations = (
            db.query(Automation)
            .filter(
                Automation.wallet_from == data.wallet_id, Automation.user_id == user_id
            )
            .order_by(Automation.scheduled_date.asc())
            .all()
        )

        automation_details = []
        for automation in all_automations:
            if automation.interval == "Daily":
                if automation.value == 1:
                    interval = "1 Day"
                else:
                    interval = f"{automation.value} Days"
            elif automation.interval == "Monthly":
                if automation.value == 1:
                    interval = "1 Month"
                else:
                    interval = f"{automation.value} Months"
            elif automation.interval == "Yearly":
                if automation.value == 1:
                    interval = "1 Year"
                else:
                    interval = f"{automation.value} Years"
            automation = {
                "id": automation.id,
                "wallet_to": automation.wallet_to,
                "tags": automation.tags,
                "category": automation.category,
                "amount": automation.amount,
                "interval": interval,
                "scheduled_date": automation.scheduled_date.strftime("%Y-%m-%d"),
            }
            automation_details.append(automation)
        return automation_details

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class AddAutomation(BaseModel):
    wallet_from: Optional[str] = None
    wallet_to: str
    tags: Optional[str] = None
    category: Optional[str] = None
    amount: float
    interval: str
    value: int


@app.post("/api/add-automation/{type}")
def add_automation(type: str, data: AddAutomation, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        if data.interval == "Daily":
            scheduled_date = date.today() + timedelta(days=data.value)
        elif data.interval == "Monthly":
            scheduled_date = date.today() + relativedelta(months=data.value)
        elif data.interval == "Yearly":
            scheduled_date = date.today() + relativedelta(years=data.value)

        if type not in ["transaction", "transfer"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid type. Must be either 'transaction' or 'transfer'.",
            )
        elif type == "transaction":
            target_wallet = (
                db.query(Wallet)
                .filter(Wallet.id == data.wallet_to, Wallet.user_id == user_id)
                .first()
            )
            # 2. Create the new automation
            new_automation = Automation(
                wallet_to=target_wallet.name if target_wallet else "Unknown Wallet",
                wallet_from=data.wallet_to,
                interval=data.interval,
                value=data.value,
                tags=data.tags,
                category=data.category,
                amount=data.amount,
                scheduled_date=scheduled_date,
                user_id=user_id,
            )

        elif type == "transfer":
            tags = f"Transfer to {data.wallet_to}"
            category = "Transfer"

            wallets = db.query(Wallet).filter(Wallet.user_id == user_id).all()
            if data.wallet_to not in [wallet.name for wallet in wallets]:
                raise HTTPException(
                    status_code=404, detail="This wallet does not exist."
                )

            new_automation = Automation(
                wallet_to=data.wallet_to,
                wallet_from=data.wallet_from,
                interval=data.interval,
                value=data.value,
                tags=tags,
                category=category,
                amount=data.amount,
                scheduled_date=scheduled_date,
                user_id=user_id,
            )
        db.add(new_automation)
        db.commit()
        return {"message": "Automation added successfully."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class UpdateAutomation(BaseModel):
    automation_id: str
    tags: str
    category: str
    amount: float
    interval: str
    value: int


@app.post("/api/update-automation")
def update_automation(data: UpdateAutomation, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        automation = (
            db.query(Automation)
            .filter(Automation.id == data.automation_id, Automation.user_id == user_id)
            .first()
        )
        if not automation:
            raise HTTPException(status_code=404, detail="Automation not found.")

        if data.interval == "Daily":
            scheduled_date = date.today() + timedelta(days=data.value)
        elif data.interval == "Monthly":
            scheduled_date = date.today() + relativedelta(months=data.value)
        elif data.interval == "Yearly":
            scheduled_date = date.today() + relativedelta(years=data.value)

        # Update the automation details
        automation.tags = data.tags
        automation.category = data.category
        automation.amount = data.amount
        automation.interval = data.interval
        automation.value = data.value
        automation.scheduled_date = scheduled_date

        db.commit()
        return {"message": "Automation updated successfully."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class DeleteAutomation(BaseModel):
    automation_id: int


@app.post("/api/delete-automation")
def delete_automation(data: DeleteAutomation, authorization: str = Header(None)):
    db = SessionLocal()
    try:
        # 1. Verify the token to get the user_id
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid request.")
        token = authorization.split(" ")[1]
        user_id = verify_access_token(token=token)
        if not user_id:
            raise HTTPException(status_code=401, detail="User not found.")

        automation = (
            db.query(Automation)
            .filter(Automation.id == data.automation_id, Automation.user_id == user_id)
            .first()
        )
        if not automation:
            raise HTTPException(status_code=404, detail="Automation not found.")

        db.delete(automation)
        db.commit()
        return {"message": "Automation deleted successfully."}

    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}
