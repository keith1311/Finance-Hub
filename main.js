async function fetchAndRenderMainPage() {
  try {
    // 1. Fetch data from your Python API
    const response = await fetch("http://127.0.0.1:8000/api/render_main_page");
    const [
      walletData,
      totalBalance,
      transactionData,
      canvasData,
      monthlyTotal,
    ] = await response.json();

    // Update the total balance display
    document.getElementById("total-balance").textContent =
      `RM${totalBalance.toFixed(2)}`;

    // Draw Wallet Cards
    const grid = document.getElementById("wallet-grid");
    grid.innerHTML = ""; // Clear any placeholders

    // 2. Loop through the actual database data
    const template = document.getElementById("wallet-template");

    walletData.forEach((wallet) => {
      const clone = template.content.cloneNode(true);

      const link = clone.querySelector(".view-btn");
      link.href = `wallets.html?id=${wallet.id}`; // Set the href to the wallet's ID
      // Set the data using textContent
      clone.querySelector(".name").textContent = wallet.name;
      clone.querySelector(".balance").textContent =
        `RM ${wallet.balance.toFixed(2)}`;

      // Append the card (NOT the grid) to the grid container
      document.getElementById("wallet-grid").appendChild(clone);
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
                <div>${tx.wallet_name || tx.wallet_id}</div>
            `;

      tableDetailsContainer.appendChild(rowDiv);
    });

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
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd3da", boxWidth: 12 },
          },
        },
      },
    });

    // Update Monthly Total
    document.getElementById("monthly-total").textContent =
      `RM${monthlyTotal.toFixed(2)}`;
  } catch (error) {
    console.error("Failed to load wallets:", error);
  }
}

// 3. Trigger the function when the page loads
fetchAndRenderMainPage();

document.addEventListener("click", function (e) {
  // 1. Identify if a button or a menu link was clicked
  const targetBtn = e.target.closest(".menu-btn, .manage-btn");

  // 2. Handle Button Clicks (Toggle Menus)
  if (targetBtn) {
    e.stopPropagation();
    const menu = targetBtn.nextElementSibling;

    // Close all other open menus
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      if (m !== menu) m.classList.remove("active");
    });

    // Toggle the targeted menu
    if (menu && menu.classList.contains("dropdown-menu")) {
      menu.classList.toggle("active");
    }
  }
  // 4. Close menus if clicking anywhere else on the page
  else {
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      m.classList.remove("active");
    });
  }
});
