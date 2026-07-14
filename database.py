import pandas as pd
import os
from datetime import datetime

filename = "database.xlsx"


def load_data():
    if os.path.exists(filename):
        df_records = pd.read_excel(filename, sheet_name="Records")
        df_wallets = pd.read_excel(filename, sheet_name="Summary")

        # Sort the dataframe by Last Used
        if "Last Used" in df_wallets.columns:
            df_wallets["Last Used"] = pd.to_datetime(df_wallets["Last Used"])
            df_wallets = df_wallets.sort_values(by="Last Used", ascending=False)
    else:
        # THE FIX: Create actual Pandas DataFrames right here inside the initialization phase
        last_used = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        df_wallets = pd.DataFrame(
            {
                "Wallet Name": ["General"],
                "Balance": [0.0],
                "Last Used": [last_used],
                "Password": [
                    "'"
                ],  # Added a placeholder char so it isn't completely void
                "Censor": [False],
                "Hide": [False],
            }
        )

        df_records = pd.DataFrame(
            {
                "Index": [],
                "WID": [],
                "Date": [],
                "Category": [],
                "Tags": [],
                "Amount": [],
                "Wallet": [],
                "Nature": [],
            }
        )

        # Save them using the Excel writer engine safely
        with pd.ExcelWriter(filename, engine="openpyxl") as writer:
            df_wallets.to_excel(writer, sheet_name="Summary", index=False)
            df_records.to_excel(writer, sheet_name="Records", index=False)
        print(f"Initialized new database: {filename}")

    # Now both paths guarantee real DataFrame objects exist!
    records_data = df_records.to_dict("records")
    wallets_data = df_wallets.to_dict("records")

    return records_data, wallets_data


records, wallets = load_data()
