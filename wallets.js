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
    const [header, canvasData, transactionData] = await response.json();

    document.getElementById("title").textContent = header.name;
    document.getElementById("total-balance").textContent =
      `RM${header.balance.toFixed(2)}`;

    // Render the canvas chart
    const ctx = document.getElementById("expenseChart");

    const myChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: canvasData.labels,
        datasets: [
          {
            data: canvasData.data,
            backgroundColor: [
              "#3b82f6",
              "#10b981",
              "#f59e0b",
              "#ef4444",
              "#8b5cf6",
              "#ec4899",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: false,
        animation: {
          duration: 1500,
        },
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd3da", boxWidth: 12 },
          },
        },
      },
    });

    // Render Transaction Table
    const tableDetailsContainer = document.getElementById("table-details");

    // Clear the placeholder text
    tableDetailsContainer.innerHTML = "";

    if (transactionData.length === 0) {
      tableDetailsContainer.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
      return;
    }

    // Loop through backend data and create rows
    transactionData.forEach((tx) => {
      const rowDiv = document.createElement("div");
      // Add a class name for your row styling (e.g., flex layout matching your headers)
      rowDiv.className = "table-row-item";

      rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>RM ${tx.amount.toFixed(2)}</div>
            `;

      tableDetailsContainer.appendChild(rowDiv);
    });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
  }
}

fetchAndRenderWalletPage();
