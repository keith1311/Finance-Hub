async function fetchAndRenderWalletPage() {
  // 1. Get the wallet ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const walletId = urlParams.get("id");

  //2. Post the wallet ID to your Python API
  try {
    // 2. Send the POST request to your FastAPI backend
    const response = await fetch(
      "http://127.0.0.1:8000/api/render_wallet_page/" + walletId,
      {
        method: "POST",
      },
    );
    const result = await response.json();

    document.getElementById("title").textContent = result.name;
    document.getElementById("total-balance").textContent =
      `RM${result.balance.toFixed(2)}`;
  } catch (error) {
    console.error("Error fetching wallet data:", error);
  }
}

fetchAndRenderWalletPage();
