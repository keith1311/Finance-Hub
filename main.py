from pathlib import Path
import webbrowser
import os


HTML = """
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width,initial-scale=1" />
	<title>Finance Hub - Mock UI</title>
	<style>
		:root{--bg:#0f1317;--card:#1a1d26;--inner:#14161f;--accent:#3b6285;--muted:#8a92a6;--text:#ffffff}
		html,body{height:100%;margin:0;background:var(--bg);font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:var(--text)}
		.container{max-width:1200px;margin:18px auto;padding:18px}
		.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
		.title{font-size:22px;font-weight:700}
		.total{text-align:right}
		.total .label{color:var(--muted);font-size:13px}
		.total .value{font-size:20px;font-weight:700}

		.workspace{display:grid;grid-template-columns:3fr 1fr;gap:18px;align-items:stretch}

		/* Left panel */
		.left .section-title{font-weight:700;margin:6px 0 12px}
		.wallet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
		.wallet{background:var(--inner);padding:14px;border-radius:12px}
		.wallet .name{color:var(--muted);font-size:14px}
		.wallet .balance{font-size:18px;font-weight:700;margin-top:8px}
		.view-btn{display:inline-block;margin-top:10px;background:var(--accent);color:#fff;padding:7px 10px;border-radius:8px;text-decoration:none}

		.table-card{background:var(--inner);border-radius:12px;padding:12px}
		.table-headers{display:flex;gap:8px;color:var(--muted);font-weight:600;padding:6px 4px}
		.table-headers div{flex:1}
		.table-scroll{max-height:260px;overflow:auto;margin-top:8px}
		.table-row{display:flex;gap:8px;padding:10px 4px;border-bottom:1px solid #121418;color:#cbd3da}
		.table-row div{flex:1}
		.placeholder{color:var(--muted);font-style:italic;padding:18px;text-align:center}

		/* Right panel */
		.right .card{background:var(--card);border-radius:14px;padding:18px;color:var(--text);display:flex;flex-direction:column;height:100%}
		.chart-area{flex:1;min-height:220px;border-radius:8px;background:linear-gradient(180deg,#0c0f12,#0b0e11);display:flex;align-items:center;justify-content:center;color:var(--muted)}
		.monthly-total{margin-top:12px;text-align:center;font-weight:700}

		@media (max-width:900px){.workspace{grid-template-columns:1fr}}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="title">FINANCE HUB</div>
			<div class="total"><div class="label">Total Balance</div><div class="value">RM0.00</div></div>
		</div>

		<div class="workspace">
			<div class="left">
				<div style="display:flex;justify-content:space-between;align-items:center">
					<div class="section-title">WALLETS &amp; ACCOUNTS</div>
					<select style="background:var(--accent);color:#fff;border-radius:6px;padding:6px 8px;border:none">
						<option>Manage</option>
						<option>Create Wallet</option>
						<option>View All Wallet</option>
					</select>
				</div>

				<div class="wallet-grid">
					<div class="wallet"><div class="name">General</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
					<div class="wallet"><div class="name">Savings</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
					<div class="wallet"><div class="name">Credit</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
					<div class="wallet"><div class="name">Wallet 4</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
					<div class="wallet"><div class="name">Wallet 5</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
					<div class="wallet"><div class="name">Wallet 6</div><div class="balance">$0.00</div><a class="view-btn">VIEW DETAILS</a></div>
				</div>

				<div class="section-title">TRANSACTION DETAILS TABLE</div>
				<div class="table-card">
					<div class="table-headers"><div>Date</div><div>Tags</div><div>Amount</div><div>Wallet</div></div>
					<div style="height:1px;background:#222633;margin:6px 0"></div>
					<div class="table-scroll">
						<div class="placeholder">[ Your log loop data will populate new rows here dynamically ]</div>
					</div>
				</div>
			</div>

			<div class="right">
				<div class="card">
					<div style="font-weight:700;margin-bottom:8px">MONTHLY EXPENSES</div>
					<div class="chart-area">⭕<br><br>[ Donut Chart Canvas Area ]</div>
					<div class="monthly-total">Monthly Total: <span style="font-size:18px">RM0.00</span></div>
				</div>
			</div>
		</div>
	</div>
</body>
</html>
"""


def write_html(path: Path):
		path.write_text(HTML, encoding="utf-8")
		return path


def main():
		out = Path(__file__).parent / "finance_hub_mock.html"
		write_html(out)
		print(f"Wrote mock UI to: {out}")
		# Open in default browser
		webbrowser.open(out.as_uri())


if __name__ == "__main__":
		main()
		