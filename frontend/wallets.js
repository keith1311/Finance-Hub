let currentIndex;
let theme = "";
let token = localStorage.getItem("authToken");
const apiURL =
  /*"https://finance-hub-qakq.onrender.com";*/ "http://127.0.0.1:8000";

// 1. Get from localStorage and convert to a number
currentIndex = parseInt(localStorage.getItem("currentIndex"));
theme = localStorage.getItem("theme");

// 2. Check if it's null (or NaN if nothing was found)
if (isNaN(currentIndex)) {
  currentIndex = 2;
  localStorage.setItem("currentIndex", currentIndex);
}
if (!theme) {
  theme = "dark";
  localStorage.setItem("theme", theme);
}

if (theme === "light") {
  document.documentElement.setAttribute("data-theme", "light");
} else {
  document.documentElement.removeAttribute("data-theme");
}
// Declare global variables (using let so they can be reassigned)
// A single global object structured to hold all metrics cleanly
// A single global object structured to hold all metrics cleanly
let metricsData = {
  daily: {
    canvasData: [],
    expense: [],
    income: [],
    savings: [],
    total: 0.0,
    percentage: [],
    nature: [],
  },
  weekly: {
    canvasData: [],
    expense: [],
    income: [],
    savings: [],
    total: 0.0,
    percentage: [],
    nature: [],
  },
  monthly: {
    canvasData: [],
    expense: [],
    income: [],
    savings: [],
    total: 0.0,
    percentage: [],
    nature: [],
  },
  yearly: {
    canvasData: [],
    expense: [],
    income: [],
    savings: [],
    total: 0.0,
    percentage: [],
    nature: [],
  },
};

let walletId = "";
let walletName = "";

async function fetchAndRenderWalletPage() {
  // Always read the latest auth token before making the request.
  token = localStorage.getItem("authToken");

  // 1. Get the wallet ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  walletId = urlParams.get("id");

  //2. Post the wallet ID to your Python API
  try {
    // 2. Send the POST request to your FastAPI backend
    const response = await fetch(
      `${apiURL}/api/render_wallet_page/` + walletId,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      },
    );
    const responseData = await response.json();

    // --- Core Info (0 to 2) ---
    const header = responseData[0];
    const transactionData = responseData[1];
    // (Assuming index 2 is your next item, or shift everything up if 1 and 2 were missing)

    // --- Daily (Indexes 2 to 6) ---
    metricsData.daily.canvasData = responseData[2];
    metricsData.daily.expense = responseData[3];
    metricsData.daily.income = responseData[4];
    metricsData.daily.savings = responseData[5];
    metricsData.daily.total = responseData[6];

    // --- Weekly (Indexes 7 to 11) ---
    metricsData.weekly.canvasData = responseData[7];
    metricsData.weekly.expense = responseData[8];
    metricsData.weekly.income = responseData[9];
    metricsData.weekly.savings = responseData[10];
    metricsData.weekly.total = responseData[11];

    // --- Monthly (Indexes 12 to 16) ---
    metricsData.monthly.canvasData = responseData[12];
    metricsData.monthly.expense = responseData[13];
    metricsData.monthly.income = responseData[14];
    metricsData.monthly.savings = responseData[15];
    metricsData.monthly.total = responseData[16];

    // --- Yearly (Indexes 17 to 21) ---
    metricsData.yearly.canvasData = responseData[17];
    metricsData.yearly.expense = responseData[18];
    metricsData.yearly.income = responseData[19];
    metricsData.yearly.savings = responseData[20];
    metricsData.yearly.total = responseData[21];

    // --- Percentage & Nature (Indexes 22 to 29) ---
    metricsData.daily.percentage = responseData[22];
    metricsData.daily.nature = responseData[23];

    metricsData.weekly.percentage = responseData[24];
    metricsData.weekly.nature = responseData[25];

    metricsData.monthly.percentage = responseData[26];
    metricsData.monthly.nature = responseData[27];

    metricsData.yearly.percentage = responseData[28];
    metricsData.yearly.nature = responseData[29];

    walletName = header.name;
    document.title = walletName;
    document.getElementById("title").textContent = walletName;
    document.getElementById("total-balance").textContent =
      `RM${header.balance.toFixed(2)}`;
    renderTransactionTable(transactionData, "table-details");
    adjustCharts();
  } catch (error) {
    console.error("Error fetching wallet data:", error);
  }
}

fetchAndRenderWalletPage();

function renderTransactionTable(transactionData, tableContainer) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById(tableContainer);

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

      let amt = "";

      if (tx.category === "Income" || tx.category === "Transfer In") {
        amt = `+ RM ${tx.amount.toFixed(2)}`;
      } else {
        amt = `- RM ${tx.amount.toFixed(2)}`;
      }

      if (tx.category === "Transfer Out" || tx.category === "Transfer In") {
        rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>RM ${tx.balance.toFixed(2)}</div>
                <button class="btn-dlt" style="width: 40px; text-align: center; border-radius: 5px; border-width: 0; margin-right: 10px;" onclick="deleteTransaction('${tx.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
      } else {
        rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>RM ${tx.balance.toFixed(2)}</div>
                <button class="btn-save" style="width: 40px; text-align: center; border-radius: 5px; border-width: 0; margin-right: 10px;" onclick="editTransaction('${tx.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
            `;
      }
      rowDiv.dataset.transactionId = tx.id; // Store the transaction ID in a data attribute for easy access

      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}

function editTransaction(transactionId) {
  const editDialog = document.getElementById("edit-dialog");
  editDialog.dataset.transactionId = transactionId;
  const transactionRow = document.querySelector(
    `[data-transaction-id="${transactionId}"]`,
  );
  const recordValue = Array.from(
    transactionRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  document.getElementById("edit-date").value = recordValue[0];
  document.getElementById("edit-tag").value = recordValue[1];
  document.getElementById("edit-cat").value = recordValue[2];
  document.getElementById("edit-amt").value = recordValue[3]
    .replace("RM ", "")
    .replace("+ ", "")
    .replace("- ", "");
  editDialog.showModal();
}

async function updateTransaction() {
  event.preventDefault(); // Prevent the default form submission behavior
  const today = new Date().toLocaleDateString("en-CA");
  const date = document.getElementById("edit-date").value;
  const tag = document
    .getElementById("edit-tag")
    .value.trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word
  const category = document.getElementById("edit-cat").value;
  const amount = document.getElementById("edit-amt").value;

  const editDialog = document.getElementById("edit-dialog");
  const transactionId = editDialog.dataset.transactionId;
  const transactionRow = document.querySelector(
    `[data-transaction-id="${transactionId}"]`,
  );
  const recordValue = Array.from(
    transactionRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  if (date > today) {
    document.getElementById("edit-date").value = today;
    document.getElementById("edit-date-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Date cannot be in the future.';
    document.getElementById("edit-tag-warning-text").innerHTML = "";
    document.getElementById("edit-amt-warning-text").innerHTML = "";
    return;
  }
  if (tag === "") {
    document.getElementById("edit-tag").value = recordValue[1];
    document.getElementById("edit-tag-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("edit-amt-warning-text").innerHTML = "";
    document.getElementById("edit-date-warning-text").innerHTML = "";

    return;
  }
  if (amount === "") {
    document.getElementById("edit-amt").value = recordValue[3]
      .replace("RM ", "")
      .replace("+ ", "")
      .replace("- ", "");
    document.getElementById("edit-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("edit-tag-warning-text").innerHTML = "";
    document.getElementById("edit-date-warning-text").innerHTML = "";
    return;
  }

  if (
    date === recordValue[0] &&
    tag === recordValue[1] &&
    category === recordValue[2] &&
    amount ===
      recordValue[3].replace("RM ", "").replace("+ ", "").replace("- ", "")
  ) {
    document.getElementById("edit-amt-warning-text").innerHTML = "";
    document.getElementById("edit-tag-warning-text").innerHTML = "";
    document.getElementById("edit-date-warning-text").innerHTML = "";
    document.getElementById("edit-dialog").close();
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/edit-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        transactionId: transactionId,
        date: date,
        tag: tag,
        category: category, // <--- Fixed: Changed semicolon to comma
        amount: parseFloat(amount),
        walletId: walletId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to edit transaction:", data.detail);

      if (
        data.detail.includes("Editing transfer transactions is not allowed")
      ) {
        alert("Editing transfer transactions is not allowed.");
        document.getElementById("edit-amt-warning-text").innerHTML = "";
        document.getElementById("edit-tag-warning-text").innerHTML = "";
        document.getElementById("edit-date-warning-text").innerHTML = "";
        document.getElementById("edit-dialog").close();
        return;
      }
    }

    // Success: Reset form and close dialog
    document.getElementById("edit-amt-warning-text").innerHTML = "";
    document.getElementById("edit-tag-warning-text").innerHTML = "";
    document.getElementById("edit-date-warning-text").innerHTML = "";
    document.getElementById("edit-dialog").close();
    fetchAndRenderWalletPage();
  } catch (error) {
    console.error("Error editting transaction:", error);
  }
}

// =================== Delete Transaction Function =================== //
const deleteTransactionBtn = document.getElementById("delete-transaction-btn");
deleteTransactionBtn.addEventListener("click", () => {
  const transactionId =
    document.getElementById("edit-dialog").dataset.transactionId;
  document.getElementById("edit-date-warning-text").innerHTML = "";
  document.getElementById("edit-amt-warning-text").innerHTML = "";
  document.getElementById("edit-tag-warning-text").innerHTML = "";
  deleteTransaction(transactionId);
});

function deleteTransaction(transactionId) {
  document.getElementById("edit-dialog").close();
  const deleteDialog = document.getElementById("delete-record-dialog");
  deleteDialog.dataset.transactionId = transactionId;
  const transactionRow = document.querySelector(
    `[data-transaction-id="${transactionId}"]`,
  );
  const recordValue = Array.from(
    transactionRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  document.getElementById("records-date").innerHTML =
    "Date: " + `&nbsp;<div class="record-value">${recordValue[0]}</div>`;
  document.getElementById("records-tag").innerHTML =
    "Tags: " + `&nbsp;<div class="record-value">${recordValue[1]}</div>`;
  document.getElementById("records-category").innerHTML =
    "Category: " + `&nbsp;<div class="record-value">${recordValue[2]}</div>`;
  document.getElementById("records-amount").innerHTML =
    "Amount: " + `&nbsp;<div class="record-value">${recordValue[3]}</div>`;
  document.getElementById("records-wallet").innerHTML =
    "Wallet: " + `&nbsp;<div class="record-value">${walletName}</div>`;
  document.getElementById("delete-record-dialog").showModal();
}

async function deleteTransactionConfirmed() {
  const deleteDialog = document.getElementById("delete-record-dialog");
  const transactionId = deleteDialog.dataset.transactionId;
  const response = await fetch(`${apiURL}/api/delete-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      transactionId: transactionId,
      walletId: walletId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    alert(`Error: ${errorData.detail}`);
    return;
  }

  fetchAndRenderWalletPage();
  deleteDialog.close();
}

// Keep track of active chart instances outside the functions
let activeExpenseChart = null;
let activeLineChart = null;

function renderRightPanel(canvasData, metricsTotal) {
  const chartArea = document.getElementById("chart-area");

  if (!canvasData.labels || canvasData.labels.length === 0) {
    if (activeExpenseChart) {
      activeExpenseChart.destroy();
      activeExpenseChart = null;
    }
    chartArea.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No data available.</div>';
    document.getElementById("metrics-amt").textContent =
      `RM${metricsTotal.toFixed(2)}`;
    return;
  }

  chartArea.innerHTML = '<canvas id="expenseChart"></canvas>';
  const ctx = document.getElementById("expenseChart").getContext("2d");

  if (activeExpenseChart) {
    activeExpenseChart.destroy();
  }

  const darkPalette = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#d946ef",
    "#64748b",
    "#eab308",
  ];

  const lightPalette = [
    "#f472b6", // Soft Pastel Pink
    "#60a5fa", // Soft Pastel Blue
    "#34d399", // Soft Pastel Emerald/Green
    "#fbbf24", // Soft Pastel Amber/Yellow
    "#a78bfa", // Soft Pastel Violet
    "#22d3ee", // Soft Pastel Cyan
    "#fb923c", // Soft Pastel Orange
    "#94a3b8", // Soft Pastel Slate Gray
    "#f87171", // Soft Pastel Red
    "#facc15", // Soft Pastel Bright Yellow
    "#818cf8", // Soft Pastel Indigo
  ];

  const currentColors = theme === "light" ? lightPalette : darkPalette;

  activeExpenseChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: canvasData.labels,
      datasets: [
        {
          data: canvasData.data,
          backgroundColor: currentColors,
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
          labels: {
            color: theme === "light" ? "#1e293b" : "#ffffff",
            boxWidth: 12,
          },
          onClick: (e, legendItem, legend) => {
            const index = legendItem.index;
            const chart = legend.chart;

            // 1. Toggle the native visibility (keeps built-in hiding behavior)
            chart.toggleDataVisibility(index);
            chart.update();

            // 2. Extract visible labels and sum their values
            let newTotal = 0;
            const visibleLabels = [];

            chart.data.labels.forEach((label, i) => {
              // Check if this data index is currently visible
              if (chart.getDataVisibility(i)) {
                visibleLabels.push(label);
                newTotal += chart.data.datasets[0].data[i];
              }
            });

            // 3. Update your metrics amount on the screen instantly
            document.getElementById("metrics-amt").textContent =
              `RM${newTotal.toFixed(2)}`;
          },
        },
      },
    },
  });

  // Update Metrics Total
  document.getElementById("metrics-amt").textContent =
    `RM${metricsTotal.toFixed(2)}`;
}

function renderLineChart(
  expenseData,
  incomeData,
  savingsData,
  dailyNumber,
  dailyNature,
  weeklyNumber,
  weeklyNature,
  monthlyNumber,
  monthlyNature,
  yearlyNumber,
  yearlyNature,
) {
  const container = document.getElementById("analysis-area");

  if (
    !expenseData.labels ||
    expenseData.labels.length === 0 ||
    !incomeData.labels ||
    incomeData.labels.length === 0 ||
    !savingsData.labels ||
    savingsData.labels.length === 0
  ) {
    if (activeLineChart) {
      activeLineChart.destroy();
      activeLineChart = null;
    }
    container.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No data available.</div>';
    return;
  }

  container.innerHTML = '<canvas id="analysis-chart"></canvas>';
  const ctx = document.getElementById("analysis-chart").getContext("2d");

  if (activeLineChart) {
    activeLineChart.destroy();
  }

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
      from: NaN,
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

  activeLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: expenseData.labels,
      datasets: [
        {
          label: "Expense",
          data: expenseData.data,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 4,
          fill: false,
        },
        {
          label: "Income",
          data: incomeData.data,
          borderColor: "rgb(15, 168, 2)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 4,
          fill: false,
        },
        {
          label: "Savings",
          data: savingsData.data,
          segment: {
            borderColor: (chartContext) => {
              const index = chartContext.p1DataIndex;
              if (index === 0) return "rgb(15, 168, 2)";

              const current = Number(savingsData.data[index].toFixed(2));
              const previous = Number(savingsData.data[index - 1].toFixed(2));

              return current >= previous
                ? "rgb(15, 168, 2)"
                : "rgb(255, 99, 132)";
            },
          },
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 4,
          pointBackgroundColor: "rgba(75, 192, 192, 0.2)",
          pointBorderWidth: 2,
          pointBorderColor: (context) => {
            const index = context.dataIndex;
            if (index === 0) return "rgb(15, 168, 2)";

            const current = Number(savingsData.data[index].toFixed(2));
            const previous = Number(savingsData.data[index - 1].toFixed(2));

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
      animation,
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
  /// Daily Displays
  const dailyIncome = document.getElementById("daily-inc-display");
  const dailyExpense = document.getElementById("daily-exp-display");
  const dailySavings = document.getElementById("daily-sav-display");

  // Weekly Displays
  const weeklyIncome = document.getElementById("weekly-inc-display");
  const weeklyExpense = document.getElementById("weekly-exp-display");
  const weeklySavings = document.getElementById("weekly-sav-display");

  // Monthly Displays
  const monthlyIncome = document.getElementById("monthly-inc-display");
  const monthlyExpense = document.getElementById("monthly-exp-display");
  const monthlySavings = document.getElementById("monthly-sav-display");

  // Yearly Displays
  const yearlyIncome = document.getElementById("yearly-inc-display");
  const yearlyExpense = document.getElementById("yearly-exp-display");
  const yearlySavings = document.getElementById("yearly-sav-display");
  // Helper function to generate the trend badge HTML
  const createDisplayHTML = (number, nature) => {
    const val = Number(number).toFixed(2);
    if (nature === "Negative") {
      return `<i class="fa-solid fa-arrow-trend-down" style="color: rgb(241, 4, 4);"></i> <span style="color: rgb(241, 4, 4);">&nbsp;${val}%</span>`;
    } else if (nature === "Positive") {
      return `<i class="fa-solid fa-arrow-trend-up" style="color: rgb(14, 212, 0);"></i> <span style="color: rgb(14, 212, 0);">&nbsp;${val}%</span>`;
    } else {
      return `<i class="fa-solid fa-repeat"></i> <span>&nbsp;${val}%</span>`;
    }
  };

  const expenseDisplayHTML = (number, nature) => {
    const val = Number(number).toFixed(2);
    if (nature === "Negative") {
      return `<i class="fa-solid fa-arrow-trend-down" style="color: rgb(14, 212, 0);"></i> <span style="color: rgb(14, 212, 0);">&nbsp;${val}%</span>`;
    } else if (nature === "Positive") {
      return `<i class="fa-solid fa-arrow-trend-up" style="color: rgb(241, 4, 4);"></i> <span style="color: rgb(241, 4, 4);">&nbsp;${val}%</span>`;
    } else {
      return `<i class="fa-solid fa-repeat"></i> <span>&nbsp;${val}%</span>`;
    }
  };
  // Populate all elements using their respective variables
  dailyIncome.innerHTML = createDisplayHTML(dailyNumber[0], dailyNature[0]);
  dailyExpense.innerHTML = expenseDisplayHTML(dailyNumber[1], dailyNature[1]);
  dailySavings.innerHTML = createDisplayHTML(dailyNumber[2], dailyNature[2]);

  weeklyIncome.innerHTML = createDisplayHTML(weeklyNumber[0], weeklyNature[0]);
  weeklyExpense.innerHTML = expenseDisplayHTML(
    weeklyNumber[1],
    weeklyNature[1],
  );
  weeklySavings.innerHTML = createDisplayHTML(weeklyNumber[2], weeklyNature[2]);

  monthlyIncome.innerHTML = createDisplayHTML(
    monthlyNumber[0],
    monthlyNature[0],
  );
  monthlyExpense.innerHTML = expenseDisplayHTML(
    monthlyNumber[1],
    monthlyNature[1],
  );
  monthlySavings.innerHTML = createDisplayHTML(
    monthlyNumber[2],
    monthlyNature[2],
  );

  yearlyIncome.innerHTML = createDisplayHTML(yearlyNumber[0], yearlyNature[0]);
  yearlyExpense.innerHTML = expenseDisplayHTML(
    yearlyNumber[1],
    yearlyNature[1],
  );
  yearlySavings.innerHTML = createDisplayHTML(yearlyNumber[2], yearlyNature[2]);
}
// ====================== Metrics Function ======================//
// 1. Target your sliding elements and arrow divs
const wrapper = document.getElementById("view-wrapper");
const wrapper2 = document.getElementById("view-wrapper2");
const wrapper3 = document.getElementById("view-wrapper3");
const wrapper4 = document.getElementById("view-wrapper4");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// 3. Handle Left Arrow click
prevBtn.addEventListener("click", async () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateSlide();
    adjustCharts();
  }
});

// 4. Handle Right Arrow click
nextBtn.addEventListener("click", async () => {
  if (currentIndex < 3) {
    currentIndex++;
    updateSlide();
    adjustCharts();
  }
});

// 5. Update slider position and get active value
function updateSlide() {
  const percentage = -currentIndex * 25;
  wrapper.style.transform = `translateX(${percentage}%)`;
  wrapper2.style.transform = `translateX(${percentage}%)`;
  wrapper3.style.transform = `translateX(${percentage}%)`;
  wrapper4.style.transform = `translateX(${percentage}%)`;

  if (currentIndex === 0) {
    prevBtn.classList.add("hidden");
  } else {
    prevBtn.classList.remove("hidden");
  }

  // If we are at the very right (Yearly), hide the next button
  if (currentIndex === 3) {
    nextBtn.classList.add("hidden");
  } else {
    nextBtn.classList.remove("hidden");
  }
}

function adjustCharts() {
  if (currentIndex === 0) {
    renderRightPanel(metricsData.daily.canvasData, metricsData.daily.total);
    renderLineChart(
      metricsData.daily.expense,
      metricsData.daily.income,
      metricsData.daily.savings,
      metricsData.daily.percentage,
      metricsData.daily.nature,
      metricsData.weekly.percentage,
      metricsData.weekly.nature,
      metricsData.monthly.percentage,
      metricsData.monthly.nature,
      metricsData.yearly.percentage,
      metricsData.yearly.nature,
    );
  } else if (currentIndex === 1) {
    renderRightPanel(metricsData.weekly.canvasData, metricsData.weekly.total);
    renderLineChart(
      metricsData.weekly.expense,
      metricsData.weekly.income,
      metricsData.weekly.savings,
      metricsData.daily.percentage,
      metricsData.daily.nature,
      metricsData.weekly.percentage,
      metricsData.weekly.nature,
      metricsData.monthly.percentage,
      metricsData.monthly.nature,
      metricsData.yearly.percentage,
      metricsData.yearly.nature,
    );
  } else if (currentIndex === 2) {
    renderRightPanel(metricsData.monthly.canvasData, metricsData.monthly.total);
    renderLineChart(
      metricsData.monthly.expense,
      metricsData.monthly.income,
      metricsData.monthly.savings,
      metricsData.daily.percentage,
      metricsData.daily.nature,
      metricsData.weekly.percentage,
      metricsData.weekly.nature,
      metricsData.monthly.percentage,
      metricsData.monthly.nature,
      metricsData.yearly.percentage,
      metricsData.yearly.nature,
    );
  } else if (currentIndex === 3) {
    renderRightPanel(metricsData.yearly.canvasData, metricsData.yearly.total);
    renderLineChart(
      metricsData.yearly.expense,
      metricsData.yearly.income,
      metricsData.yearly.savings,
      metricsData.daily.percentage,
      metricsData.daily.nature,
      metricsData.weekly.percentage,
      metricsData.weekly.nature,
      metricsData.monthly.percentage,
      metricsData.monthly.nature,
      metricsData.yearly.percentage,
      metricsData.yearly.nature,
    );
  } else {
    // Fixed: Replaced Python string formatting with JavaScript template literal
    console.error(`Error: Invalid currentIndex of ${currentIndex}`);
    alert(`Error: Invalid slide index (${currentIndex})`);
  }
}

//=============== Add Income ==============//
const addIncome = document.getElementById("add-income");

addIncome.addEventListener("click", (e) => {
  const dialog = document.getElementById("income-dialog");
  const dateInput = document.getElementById("income-date");

  const formattedDate = new Date().toLocaleDateString("en-CA");

  // 3. Assign the formatted string
  dateInput.value = formattedDate;

  dialog.showModal();
  document.getElementById("income-tag").focus();
});
//=============== Create Transaction ==============//
const createTransaction = document.getElementById("create-transaction");

createTransaction.addEventListener("click", (e) => {
  const dialog = document.getElementById("transaction-dialog");
  const dateInput = document.getElementById("transaction-date");

  const formattedDate = new Date().toLocaleDateString("en-CA");

  // 3. Assign the formatted string
  dateInput.value = formattedDate;

  dialog.showModal();
  document.getElementById("transaction-tag").focus();
});

// =================== Income Function =================== //
const incomeDialog = document.getElementById("income-dialog");
const incomeForm = document.getElementById("income-form");
const incDateInput = document.getElementById("income-date");
const incDateWarning = document.getElementById("inc-date-warning-text");
const incTagInput = document.getElementById("income-tag");
const incTagWarning = document.getElementById("inc-tag-warning-text");
const incAmtInput = document.getElementById("income-amt");
const incAmtWarning = document.getElementById("inc-amt-warning-text");

incomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const today = new Date().toLocaleDateString("en-CA");
  const date = incDateInput.value;
  const tag = incTagInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word
  const amount = incAmtInput.value;

  if (date > today) {
    incDateInput.value = today;
    incDateWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Date cannot be in the future.';
    incTagWarning.innerHTML = "";
    incAmtWarning.innerHTML = "";
    return;
  }
  if (tag === "") {
    incTagWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    incAmtWarning.innerHTML = "";
    incDateWarning.innerHTML = "";

    return;
  }
  if (amount === "") {
    incAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    incTagWarning.innerHTML = "";
    incDateWarning.innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    incAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    incTagWarning.innerHTML = "";
    incDateWarning.innerHTML = "";
    incAmtInput.value = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/add-income`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        date: date,
        tag: tag,
        amount: parseFloat(amount),
        wallet_id: walletId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to add income:", data.detail);
      return;
    }

    // Success: Reset form and close dialog
    incDateWarning.innerHTML = "";
    incAmtWarning.innerHTML = "";
    incTagWarning.innerHTML = "";
    incomeForm.reset();
    incomeDialog.close();
    fetchAndRenderWalletPage();

    // Optionally refresh your UI/transactions list here
  } catch (error) {
    console.error("Error submitting income:", error);
  }
});

// =================== Transaction Function =================== //
const transactionDialog = document.getElementById("transaction-dialog");
const transactionForm = document.getElementById("transaction-form");
const tranDateInput = document.getElementById("transaction-date");
const tranDateWarning = document.getElementById("tran-date-warning-text");
const tranTagInput = document.getElementById("transaction-tag");
const tranTagWarning = document.getElementById("tran-tag-warning-text");
const tranCatInput = document.getElementById("transaction-cat");
const tranAmtInput = document.getElementById("transaction-amt");
const tranAmtWarning = document.getElementById("tran-amt-warning-text");

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const today = new Date().toLocaleDateString("en-CA");
  const date = tranDateInput.value;
  const tag = tranTagInput.value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const category = tranCatInput.value;
  const amount = tranAmtInput.value;

  if (date > today) {
    tranDateInput.value = today;
    tranDateWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Date cannot be in the future.';
    tranTagWarning.innerHTML = "";
    tranAmtWarning.innerHTML = "";
    return;
  }

  if (tag === "") {
    tranTagWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    tranAmtWarning.innerHTML = "";
    tranDateWarning.innerHTML = "";
    return;
  }
  if (amount === "") {
    tranAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    tranTagWarning.innerHTML = "";
    tranDateWarning.innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    tranAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    tranTagWarning.innerHTML = "";
    tranDateWarning.innerHTML = "";
    tranAmtInput.value = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/create-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        date: date,
        tag: tag,
        category: category, // <--- Fixed: Changed semicolon to comma
        amount: parseFloat(amount),
        wallet_id: walletId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to add transaction:", data.detail);
      return;
    }

    // Success: Reset form and close dialog
    tranDateWarning.innerHTML = "";
    tranAmtWarning.innerHTML = "";
    tranTagWarning.innerHTML = "";
    transactionForm.reset();
    transactionDialog.close();
    fetchAndRenderWalletPage();
  } catch (error) {
    console.error("Error submitting transaction:", error);
  }
});

// ============= Filter Function ============= //
const openFilter = document.getElementById("open-filter");
const filterDialog = document.getElementById("filter-dialog");
const filterForm = document.getElementById("filter-form");

openFilter.addEventListener("click", function () {
  const filterDetails = document.getElementById("filter-details");

  filterDetails.innerHTML =
    '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
  filterDialog.showModal();
});

const inputRowFilter = document.getElementById("filter-row");
const inputDateFilter = document.getElementById("filter-date");
const inputTagFilter = document.getElementById("filter-tag");
const inputCatFilter = document.getElementById("filter-cat");
const operatorFilter = document.getElementById("operator");
const inputAmountFilter = document.getElementById("filter-amount");
const inputBalanceFilter = document.getElementById("filter-balance");

filterForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const row = inputRowFilter.value;
  const date = inputDateFilter.value;
  const tag = inputTagFilter.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  const category = inputCatFilter.value;
  const operator = operatorFilter.value;
  const amount = inputAmountFilter.value;
  const balanceAfter = inputBalanceFilter.value;

  try {
    const response = await fetch(`${apiURL}/api/get-filter/` + "wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        row: row || null,
        date: date || null,
        tag: tag || null,
        category: category || null,
        operator: operator || null,
        amount: amount || null,
        wallet_id: walletId || null,
        balance_after: balanceAfter || null,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch filtered transactions");
    }

    const [data, rowCounter, total] = await response.json();

    renderFilterTable(data, "filter-details");
    document.getElementById("total-filter-amount").textContent =
      `RM${total.toFixed(2)}`;
    inputRowFilter.value = rowCounter; // Update the row input with the count of filtered rows
  } catch (error) {
    console.error("Error:", error);
  }
});

function renderFilterTable(transactionData, tableContainer) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById(tableContainer);

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

      let amt = "";

      if (tx.category === "Income" || tx.category === "Transfer In") {
        amt = `+ RM ${tx.amount.toFixed(2)}`;
      } else {
        amt = `- RM ${tx.amount.toFixed(2)}`;
      }

      rowDiv.innerHTML = `
                <div>${tx.index}</div>
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>RM ${tx.balance.toFixed(2)}</div>
            `;
      rowDiv.dataset.transactionId = tx.id; // Store the transaction ID in a data attribute for easy access

      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}

// =================== Transfer Function  =================== //
const transferBtn = document.getElementById("transfer-money");
const transferForm = document.getElementById("transfer-form");
const transferDialog = document.getElementById("transfer-dialog");

transferBtn.addEventListener("click", () => {
  const transferDialog = document.getElementById("transfer-dialog");
  const dateInput = document.getElementById("transfer-date");
  const today = new Date().toLocaleDateString("en-CA");
  dateInput.value = today;
  transferDialog.showModal();
});

transferForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const today = new Date().toLocaleDateString("en-CA");
  const date = document.getElementById("transfer-date").value;
  const fromWalletId = walletId;
  const toWallet = document
    .getElementById("transfer-wallet")
    .value.trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const amount = document.getElementById("transfer-amt").value;
  const dateWarning = document.getElementById("transfer-date-warning-text");
  const walletWarning = document.getElementById("transfer-wallet-warning-text");
  const amtWarning = document.getElementById("transfer-amt-warning-text");

  if (date > today) {
    document.getElementById("transfer-date").value = today;
    dateWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Date cannot be in the future.';
    walletWarning.innerHTML = "";
    amtWarning.innerHTML = "";
    return;
  }

  if (toWallet === "") {
    walletWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    amtWarning.innerHTML = "";
    dateWarning.innerHTML = "";
    return;
  }

  if (amount === "") {
    amtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    walletWarning.innerHTML = "";
    dateWarning.innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    amtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    walletWarning.innerHTML = "";
    dateWarning.innerHTML = "";
    document.getElementById("transfer-amt").value = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/transfer-money`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        date: date,
        amount: parseFloat(amount),
        from_wallet_id: fromWalletId,
        to_wallet: toWallet,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check the error status properly
      const statusCode = response.status || data.status;

      if (statusCode === 404 || statusCode === 400) {
        walletWarning.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.detail}`;
        dateWarning.value = "";
        amtWarning.innerHTML = "";
        document.getElementById("transfer-wallet").value = "";
        return;
      }

      if (statusCode === 401) {
        alert("Unauthorized: Please log in again.");
        localStorage.removeItem("authToken");
        document.getElementById("login-dialog").showModal();
        return;
      }
    }

    // Success: Reset form and close dialog
    dateWarning.innerHTML = "";
    amtWarning.innerHTML = "";
    walletWarning.innerHTML = "";
    transferForm.reset();
    transferDialog.close();
    fetchAndRenderWalletPage();
  } catch (error) {
    console.error("Error submitting transaction:", error);
  }
});

// =================== Automation Function  =================== //
function renderAutomationTable(transactionData, tableContainer) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById(tableContainer);

  // Clear the placeholder text
  tableDetailsContainer.innerHTML = "";

  if (transactionData.length === 0) {
    tableDetailsContainer.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No automations found.</div>';
  } else {
    transactionData.forEach((tx) => {
      const rowDiv = document.createElement("div");
      // Add a class name for your row styling (e.g., flex layout matching your headers)
      rowDiv.className = "table-row-item";

      let amt = "";

      if (tx.category === "Income") {
        amt = `+ RM ${tx.amount.toFixed(2)}`;
      } else {
        amt = `- RM ${tx.amount.toFixed(2)}`;
      }

      if (tx.category === "Transfer") {
        rowDiv.innerHTML = `
                <div>${tx.wallet_to}</div>
                <div>${tx.tags}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>${tx.interval}</div>
                <div>${tx.scheduled_date}</div>
                <button class="btn-dlt" style="width: 40px; text-align: center; border-radius: 5px; border-width: 0; margin-right: 10px;" onclick="deleteAutomation('${tx.id}')"><i class="fa-solid fa-trash-can"></i></button>
            `;
      } else {
        rowDiv.innerHTML = `
               <div>${tx.wallet_to}</div>
                <div>${tx.tags}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>${tx.interval}</div>
                <div>${tx.scheduled_date}</div>
                <button class="btn-save" style="width: 40px; text-align: center; border-radius: 5px; border-width: 0; margin-right: 10px;" onclick="editAutomation('${tx.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
            `;
      }
      rowDiv.dataset.automationId = tx.id; // Store the automation ID in a data attribute for easy access

      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}

// =================== Edit Automation Function  =================== //
function editAutomation(automationId) {
  const editAutomationDialog = document.getElementById("edit-auto-dialog");
  editAutomationDialog.dataset.automationId = automationId;
  const automationRow = document.querySelector(
    `[data-automation-id="${automationId}"]`,
  );
  const recordValue = Array.from(
    automationRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  const autoValue = recordValue[4].split(" ")[0];
  const rawInterval = recordValue[4].split(" ")[1];
  let interval = "";

  if (rawInterval === "Day" || rawInterval === "Days") {
    interval = "Daily";
  } else if (rawInterval === "Month" || rawInterval === "Months") {
    interval = "Monthly";
  } else if (rawInterval === "Year" || rawInterval === "Years") {
    interval = "Yearly";
  }

  document.getElementById("edit-auto-tag").value = recordValue[1];
  document.getElementById("edit-auto-cat").value = recordValue[2];
  document.getElementById("edit-auto-amt").value = recordValue[3]
    .replace("RM ", "")
    .replace("+ ", "")
    .replace("- ", "");
  document.getElementById("edit-auto-interval").value = interval;
  document.getElementById("edit-auto-value").value = autoValue;
  editAutomationDialog.showModal();
}

async function updateAutomation() {
  const tag = document
    .getElementById("edit-auto-tag")
    .value.trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const category = document.getElementById("edit-auto-cat").value;
  const amount = document.getElementById("edit-auto-amt").value;
  const interval = document.getElementById("edit-auto-interval").value;
  const value = document.getElementById("edit-auto-value").value;
  const editDialog = document.getElementById("edit-auto-dialog");
  const automationId = editDialog.dataset.automationId;
  const automationRow = document.querySelector(
    `[data-automation-id="${automationId}"]`,
  );
  const recordValue = Array.from(
    automationRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  if (tag === "") {
    document.getElementById("edit-auto-tag-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("edit-auto-amt-warning-text").innerHTML = "";
    document.getElementById("edit-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (amount === "") {
    document.getElementById("edit-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    document.getElementById("edit-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-value-warning-text").innerHTML = "";
    document.getElementById("edit-auto-amt").value = "";
    return;
  }

  if (value === "") {
    document.getElementById("edit-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-amt-warning-text").innerHTML = "";
    HTML = "";
    return;
  }

  if (parseFloat(value) <= 0) {
    document.getElementById("edit-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Value must be greater than zero.';
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-amt-warning-text").innerHTML = "";
    document.getElementById("edit-auto-value").value = "";
    return;
  }

  const autoValue = recordValue[4].split(" ")[0];
  const rawInterval = recordValue[4].split(" ")[1];
  let actualInterval = "";

  if (rawInterval === "Day" || rawInterval === "Days") {
    actualInterval = "Daily";
  } else if (rawInterval === "Month" || rawInterval === "Months") {
    actualInterval = "Monthly";
  } else if (rawInterval === "Year" || rawInterval === "Years") {
    actualInterval = "Yearly";
  }

  if (
    tag === recordValue[1] &&
    category === recordValue[2] &&
    amount ===
      recordValue[3].replace("RM ", "").replace("+ ", "").replace("- ", "") &&
    value === autoValue &&
    interval === actualInterval
  ) {
    // No changes to be made
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-amt-warning-text").innerHTML = "";
    document.getElementById("edit-auto-value-warning-text").innerHTML = "";
    editDialog.close();
    return;
  }
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/update-automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        automation_id: automationId,
        tags: tag,
        category: category,
        amount: parseFloat(amount),
        interval: interval,
        value: parseFloat(value),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check the error status properly
      const statusCode = response.status || data.status;

      if (statusCode === 401) {
        alert("Unauthorized: Please log in again.");
        localStorage.removeItem("authToken");
        document.getElementById("login-dialog").showModal();
        return;
      }
    }

    // Success: Reset form and close dialog
    document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
    document.getElementById("edit-auto-amt-warning-text").inner;
    HTML = "";
    document.getElementById("edit-auto-value-warning-text").innerHTML = "";
    editDialog.close();
    fetchAndRenderAutomation();
  } catch (error) {
    console.error("Error updating automation:", error);
  }
}

// =================== Delete Automation Function  =================== //
const deleteAutomationBtn = document.getElementById("delete-automation-btn");
deleteAutomationBtn.addEventListener("click", () => {
  const automationId =
    document.getElementById("edit-auto-dialog").dataset.automationId;
  document.getElementById("edit-auto-tag-warning-text").innerHTML = "";
  document.getElementById("edit-auto-amt-warning-text").innerHTML = "";
  document.getElementById("edit-auto-value-warning-text").innerHTML = "";
  deleteAutomation(automationId);
  document.getElementById("edit-auto-dialog").close();
});

function deleteAutomation(automationId) {
  const deleteAutomationDialog = document.getElementById("delete-auto-dialog");
  deleteAutomationDialog.dataset.automationId = automationId;
  const automationRow = document.querySelector(
    `[data-automation-id="${automationId}"]`,
  );
  const recordValue = Array.from(
    automationRow.querySelectorAll("div, button"),
  ).map((el) => el.textContent.trim());

  document.getElementById("automation-wallet").innerHTML =
    "Wallet: " + `&nbsp;<div class="record-value">${recordValue[0]}</div>`;
  document.getElementById("automation-tag").innerHTML =
    "Tags: " + `&nbsp;<div class="record-value">${recordValue[1]}</div>`;
  document.getElementById("automation-category").innerHTML =
    "Category: " + `&nbsp;<div class="record-value">${recordValue[2]}</div>`;
  document.getElementById("automation-amount").innerHTML =
    "Amount: " + `&nbsp;<div class="record-value">${recordValue[3]}</div>`;
  document.getElementById("automation-interval").innerHTML =
    "Interval: " + `&nbsp;<div class="record-value">${recordValue[4]}</div>`;
  document.getElementById("automation-scheduled-date").innerHTML =
    "Scheduled Date: " +
    `&nbsp;<div class="record-value">${recordValue[5]}</div>`;
  deleteAutomationDialog.showModal();
}
async function deleteAutomationConfirmed() {
  const automationId =
    document.getElementById("delete-auto-dialog").dataset.automationId;
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/delete-automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        automation_id: parseInt(automationId),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to delete automation:", errorData.detail);
      return;
    }
    document.getElementById("delete-auto-dialog").close();
    fetchAndRenderAutomation();
  } catch (error) {
    console.error("Error deleting automation:", error);
  }
}

async function fetchAndRenderAutomation() {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/render-automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        wallet_id: walletId,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to fetch automation data:", data.detail);
      return;
    }

    const automationTable = document.getElementById("automation-details");
    renderAutomationTable(data, "automation-details");
    document.getElementById("manage-auto-dialog").showModal();
  } catch (error) {
    console.error("Error fetching automation data:", error);
  }
}

const transactionAutomationForm = document.getElementById("tran-auto-form");
const transactionAutomationDialog = document.getElementById("tran-auto-dialog");

transactionAutomationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tags = document
    .getElementById("tran-auto-tag")
    .value.trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word
  const category = document.getElementById("tran-auto-cat").value;
  const amount = document.getElementById("tran-auto-amt").value;
  const interval = document.getElementById("tran-interval").value;
  const value = document.getElementById("tran-auto-value").value;

  if (tags === "") {
    document.getElementById("tran-auto-tag-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("tran-auto-amt-warning-text").innerHTML = "";
    document.getElementById("tran-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (amount === "") {
    document.getElementById("tran-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("tran-auto-tag-warning-text").innerHTML = "";
    document.getElementById("tran-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    document.getElementById("tran-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    document.getElementById("tran-auto-tag-warning-text").innerHTML = "";
    document.getElementById("tran-auto-value-warning-text").innerHTML = "";
    document.getElementById("tran-auto-amt").value = "";
    return;
  }

  if (value === "") {
    document.getElementById("tran-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("tran-auto-tag-warning-text").innerHTML = "";
    document.getElementById("tran-auto-amt-warning-text").innerHTML = "";
    return;
  }

  if (parseFloat(value) <= 0) {
    document.getElementById("tran-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Value must be greater than zero.';
    document.getElementById("tran-auto-tag-warning-text").innerHTML = "";
    document.getElementById("tran-auto-amt-warning-text").innerHTML = "";
    document.getElementById("tran-auto-value").value = "";
    return;
  }
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/add-automation/transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        tags: tags,
        category: category,
        amount: parseFloat(amount),
        interval: interval,
        value: parseFloat(value),
        wallet_to: walletId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check the error status properly
      const statusCode = response.status || data.status;

      if (statusCode === 401) {
        alert("Unauthorized: Please log in again.");
        localStorage.removeItem("authToken");
        document.getElementById("login-dialog").showModal();
        return;
      }
    }

    // Success: Reset form and close dialog
    document.getElementById("tran-auto-amt-warning-text").innerHTML = "";
    document.getElementById("tran-auto-tag-warning-text").innerHTML = "";
    document.getElementById("tran-auto-value-warning-text").innerHTML = "";
    transactionAutomationForm.reset();
    transactionAutomationDialog.close();
    fetchAndRenderAutomation();
  } catch (error) {
    console.error("Error submitting transaction:", error);
  }
});

const transferAutomationForm = document.getElementById("transfer-auto-form");
const transferAutomationDialog = document.getElementById(
  "transfer-auto-dialog",
);

transferAutomationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const walletTo = document
    .getElementById("transfer-auto-wallet")
    .value.trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word
  const amount = document.getElementById("transfer-auto-amt").value;
  const interval = document.getElementById("transfer-interval").value;
  const value = document.getElementById("transfer-auto-value").value;

  if (walletTo === "") {
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("transfer-auto-amt-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (amount === "") {
    document.getElementById("transfer-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-value-warning-text").innerHTML = "";
    return;
  }

  if (parseFloat(amount) <= 0) {
    document.getElementById("transfer-auto-amt-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Amount must be greater than zero.';
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-value-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-amt").value = "";
    return;
  }

  if (value === "") {
    document.getElementById("transfer-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-amt-warning-text").innerHTML = "";
    return;
  }

  if (parseFloat(value) <= 0) {
    document.getElementById("transfer-auto-value-warning-text").innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Value must be greater than zero.';
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-amt-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-value").value = "";
    return;
  }
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/add-automation/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        wallet_to: walletTo,
        amount: parseFloat(amount),
        interval: interval,
        value: parseFloat(value),
        wallet_from: walletId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check the error status properly
      const statusCode = response.status || data.status;

      if (statusCode === 404) {
        document.getElementById("transfer-auto-wallet-warning-text").innerHTML =
          '<i class="fa-solid fa-triangle-exclamation"></i> ' + data.detail;
        document.getElementById("transfer-auto-wallet").value = "";
        document.getElementById("transfer-auto-amt-warning-text").innerHTML =
          "";
        document.getElementById("transfer-auto-value-warning-text").innerHTML =
          "";
        return;
      }

      if (statusCode === 401) {
        alert("Unauthorized: Please log in again.");
        localStorage.removeItem("authToken");
        document.getElementById("login-dialog").showModal();
        return;
      }
    }

    // Success: Reset form and close dialog
    document.getElementById("transfer-auto-amt-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-wallet-warning-text").innerHTML = "";
    document.getElementById("transfer-auto-value-warning-text").innerHTML = "";
    transferAutomationForm.reset();
    transferAutomationDialog.close();
    fetchAndRenderAutomation();
  } catch (error) {
    console.error("Error submitting transaction:", error);
  }
});
