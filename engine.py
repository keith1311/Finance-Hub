from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import load_data


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/renderwallets")
def render_wallets():
    records, wallets = load_data()
    top_six = wallets[:6]
    rendered_wallets = []
    for wallet in top_six:
        rendered_wallets.append(
            {"name": wallet["Wallet Name"], "balance": wallet["Balance"]}
        )
    return rendered_wallets


@app.get("/api/total-balance")
def get_total_balance():
    records, wallets = load_data()
    total_balance = sum(wallet["Balance"] for wallet in wallets)
    return total_balance
