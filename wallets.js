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
    const [
      header,
      canvasData,
      transactionData,
      monthlyTotal,
      expenseData,
      incomeData,
      savingsData,
    ] = await response.json();

    document.getElementById("title").textContent = header.name;
    document.getElementById("total-balance").textContent =
      `RM${header.balance.toFixed(2)}`;

    // Render the canvas chart
    const ctx = document.getElementById("expenseChart");

    if (!canvasData.labels || canvasData.labels.length === 0) {
      document.getElementById("chart-area").innerHTML =
        '<div style="padding: 12px; text-align: center; color: #888;">No data available.</div>';
    } else {
      const myChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: canvasData.labels,
          datasets: [
            {
              data: canvasData.data,
              backgroundColor: [
                "#3b82f6", // Blue (Groceries)
                "#10b981", // Emerald (Income)
                "#f59e0b", // Amber (Healthcare)
                "#ef4444", // Red (Bills)
                "#8b5cf6", // Violet (Food & Dining)
                "#ec4899", // Pink (Entertainment)
                "#06b6d4", // Cyan (Transport)
                "#f97316", // Orange
                "#d946ef", // Fuchsia
                "#64748b", // Slate Gray
                "#eab308", // Yellow
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
    }

    // Render Transaction Table
    const tableDetailsContainer = document.getElementById("table-details");

    // Clear the placeholder text
    tableDetailsContainer.innerHTML = "";

    if (transactionData.length === 0) {
      tableDetailsContainer.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
    } else {
      transactionData.forEach((tx) => {
        const rowDiv = document.createElement("div");
        // Add a class name for your row styling (e.g., flex layout matching your headers)
        rowDiv.className = "table-row-item";

        rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>RM ${tx.amount.toFixed(2)}</div>
                <div>RM ${tx.balance.toFixed(2)}</div>
            `;

        tableDetailsContainer.appendChild(rowDiv);
      });
    }

    // Update Monthly Total
    document.getElementById("monthly-total").textContent =
      `RM${monthlyTotal.toFixed(2)}`;

    // Render Line Chart
    // Render Line Chart
    const lineChart = document.getElementById("analysis-chart");
    const totalDuration = 500;
    const delayBetweenPoints = totalDuration / expenseData.labels.length;

    const previousY = (ctx) =>
      ctx.index === 0
        ? ctx.chart.scales.y.getPixelForValue(100)
        : ctx.chart
            .getDatasetMeta(ctx.datasetIndex)
            .data[ctx.index - 1].getProps(["y"], true).y;

    const animation = {
      x: {
        type: "number",
        easing: "linear",
        duration: delayBetweenPoints,
        from: NaN, // the point is initially skipped
        delay(ctx) {
          if (ctx.type !== "data" || ctx.xStarted) {
            return 0;
          }
          ctx.xStarted = true;
          return ctx.index * delayBetweenPoints;
        },
      },
      y: {
        type: "number",
        easing: "linear",
        duration: delayBetweenPoints,
        from: previousY,
        delay(ctx) {
          if (ctx.type !== "data" || ctx.yStarted) {
            return 0;
          }
          ctx.yStarted = true;
          return ctx.index * delayBetweenPoints;
        },
      },
    };

    const myChart = new Chart(lineChart, {
      type: "line",
      data: {
        labels: expenseData.labels, // Removed extra brackets
        datasets: [
          {
            label: "Expense",
            data: expenseData.data, // Removed extra brackets
            borderColor: "rgb(255, 99, 132)", // Changed to Red
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderWidth: 2,
            pointRadius: 4, // Set to e.g. 4 if you want dots back
            pointHoverRadius: 4, // Set to e.g. 6 if you want hover dots back
            fill: false,
          },
          {
            label: "Income",
            data: incomeData.data, // Removed extra brackets
            borderColor: "rgb(15, 168, 2)", // Changed to Green
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderWidth: 2,
            pointRadius: 4, // Set to e.g. 4 if you want dots back
            pointHoverRadius: 4, // Set to e.g. 6 if you want hover dots back
            fill: false,
          },
          {
            label: "Savings",
            data: savingsData.data, // Removed extra brackets
            // Dynamic segment color for Savings: Green if higher/equal, Red if lower than previous month
            segment: {
              borderColor: (lineChart) => {
                const index = lineChart.p1DataIndex;
                if (index === 0) return "rgb(15, 168, 2)"; // Default green for first month

                const current = Number(savingsData.data[index].toFixed(2));
                const previous = Number(savingsData.data[index - 1].toFixed(2));

                // Green if higher or equal, Red if lower than the previous month
                return current >= previous
                  ? "rgb(15, 168, 2)"
                  : "rgb(255, 99, 132)";
              },
            },
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderWidth: 2,
            pointRadius: 4, // Set to e.g. 4 if you want dots back
            pointHoverRadius: 4, // Set to e.g. 6 if you want hover dots back
            pointBackgroundColor: "rgba(75, 192, 192, 0.2)", // Dark center fill inside the dot (or match your background)
            pointBorderWidth: 2, // Thickness of the dot's border
            pointBorderColor: (context) => {
              const index = context.dataIndex;
              if (index === 0) return "rgb(15, 168, 2)";

              const current = Number(savingsData.data[index].toFixed(2));
              const previous = Number(savingsData.data[index - 1].toFixed(2));

              // Green border if higher/equal, Red border if lower
              return current >= previous
                ? "rgb(15, 168, 2)"
                : "rgb(255, 99, 132)";
            },
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation, // Injects the progressive left-to-right draw animation
        interaction: {
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
  }
}

fetchAndRenderWalletPage();
