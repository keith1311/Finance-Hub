let currentIndex;
let theme = "";
const token = localStorage.getItem("authToken");

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

async function fetchAndRenderWalletPage() {
  // 1. Get the wallet ID from the URL
  const urlParams = new URLSearchParams(window.location.search);
  walletId = urlParams.get("id");

  //2. Post the wallet ID to your Python API
  try {
    // 2. Send the POST request to your FastAPI backend
    const response = await fetch(
      "http://127.0.0.1:8000/api/render_wallet_page/" + walletId,
      {
        method: "POST",
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
    document.getElementById("title").textContent = header.name;
    document.getElementById("total-balance").textContent =
      `RM${header.balance.toFixed(2)}`;
    renderTransactionTable(transactionData);
    adjustCharts();
  } catch (error) {
    console.error("Error fetching wallet data:", error);
  }
}

fetchAndRenderWalletPage();

function renderTransactionTable(transactionData) {
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

      let amt = "";

      if (tx.category === "Income") {
        amt = `+ RM ${tx.amount.toFixed(2)}`;
      } else {
        amt = `- RM ${tx.amount.toFixed(2)}`;
      }

      rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>RM ${tx.balance.toFixed(2)}</div>
            `;

      tableDetailsContainer.appendChild(rowDiv);
    });
  }
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

  activeExpenseChart = new Chart(ctx, {
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
const incTagInput = document.getElementById("income-tag");
const incTagWarning = document.getElementById("inc-tag-warning-text");
const incAmtInput = document.getElementById("income-amt");
const incAmtWarning = document.getElementById("inc-amt-warning-text");

incomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const date = incDateInput.value;
  const tag = incTagInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word
  const amount = incAmtInput.value;

  if (tag === "") {
    incTagWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    incAmtWarning.innerHTML = "";

    return;
  }
  if (amount === "") {
    incAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    incTagWarning.innerHTML = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch("http://127.0.0.1:8000/api/add-income", {
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
const tranTagInput = document.getElementById("transaction-tag");
const tranTagWarning = document.getElementById("tran-tag-warning-text");
const tranCatInput = document.getElementById("transaction-cat");
const tranAmtInput = document.getElementById("transaction-amt");
const tranAmtWarning = document.getElementById("tran-amt-warning-text");

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const date = tranDateInput.value;
  const tag = tranTagInput.value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const category = tranCatInput.value;
  const amount = tranAmtInput.value;

  if (tag === "") {
    tranTagWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    tranAmtWarning.innerHTML = "";
    return;
  }
  if (amount === "") {
    tranAmtWarning.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    tranTagWarning.innerHTML = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(
      "http://127.0.0.1:8000/api/create-transaction",
      {
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
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to add transaction:", data.detail);
      return;
    }

    // Success: Reset form and close dialog
    tranAmtWarning.innerHTML = "";
    tranTagWarning.innerHTML = "";
    transactionForm.reset();
    transactionDialog.close();
    fetchAndRenderWalletPage();
  } catch (error) {
    console.error("Error submitting transaction:", error);
  }
});

// ============= Settings Function ============= //
const openSettings = document.getElementById("open-settings");
const settingsDialog = document.getElementById("settings-dialog");
const themesInput = document.getElementById("settings-theme");
const intInput = document.getElementById("settings-metrics");

openSettings.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(
      "http://127.0.0.1:8000/api/render-settings/" + token,
      {
        method: "POST",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to fetch settings:", data.detail);
      return;
    }

    // Extract values from the backend response dictionary
    const email = data.email;
    const pfp = data.profile_picture;
    const lockedWallets = data.locked_wallets;

    // Update settings UI elements
    document.getElementById("settings-email").textContent = email;

    const pfpElement = document.getElementById("settings-pfp");

    pfpElement.src = "http://127.0.0.1:8000/uploads/" + pfp;

    // Set dropdown selections based on current active variables
    themesInput.value = theme; // "Light" or "Dark"

    // Map numeric currentIndex (0-3) to dropdown string values ("Daily", "Weekly", etc.)
    const indexToInterval = {
      0: "daily",
      1: "weekly",
      2: "monthly",
      3: "yearly",
    };
    intInput.value = indexToInterval[currentIndex] || "monthly";

    settingsDialog.showModal();
  } catch (error) {
    console.error("Error opening settings:", error);
  }
});

// ============= Change PW Function ============= //
const changeForm = document.getElementById("change-form");
const oldPasswordInput = document.getElementById("old-password");
const newPasswordInput = document.getElementById("new-password");
const oldWarningText = document.getElementById("old-warning-text");
const newWarningText = document.getElementById("new-warning-text");
const changeDialog = document.getElementById("change-dialog");

oldPasswordInput.addEventListener("input", () => {
  const password = oldPasswordInput.value.trim();

  if (password.length === 0) {
    oldWarningText.innerHTML = "";
    oldWarningText.style.color = "";
    return;
  }

  if (password.length < 8) {
    oldWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    oldWarningText.style.color = "";
    return;
  }

  if (password.length >= 8) {
    oldWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    oldWarningText.style.color = "#10b981";
  }
});

newPasswordInput.addEventListener("input", () => {
  const password = newPasswordInput.value.trim();

  if (password.length === 0) {
    newWarningText.innerHTML = "";
    newWarningText.style.color = "";
    return;
  }

  if (password.length < 8) {
    newWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    newWarningText.style.color = "";
    return;
  }

  if (password.length >= 8) {
    newWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    newWarningText.style.color = "#10b981";
  }
});

changeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Use distinct names for string values to prevent shadowing DOM elements
  const oldVal = oldPasswordInput.value.trim();
  const newVal = newPasswordInput.value.trim();

  if (oldVal.length < 8) {
    oldWarningText.style.color = "";
    oldWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    oldPasswordInput.value = "";
    newWarningText.innerHTML = "";
    return;
  }

  if (newVal.length < 8) {
    newWarningText.style.color = "";
    newWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    newPasswordInput.value = "";
    return;
  }

  if (newVal === oldVal) {
    newWarningText.style.color = "";
    newWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Password cannot be the same.';
    newPasswordInput.value = "";
    oldPasswordInput.value = "";
    oldWarningText.innerHTML = "";
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch("http://127.0.0.1:8000/api/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        oldPassword: oldVal,
        newPassword: newVal,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      oldWarningText.style.color = "";
      oldWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.detail}`;
      newWarningText.innerHTML = "";
      oldPasswordInput.value = "";
      newPasswordInput.value = "";
      return; // Added return so it stops here and doesn't close the dialog on failure
    }

    // Success: Reset form and close dialog
    oldWarningText.innerHTML = "";
    newWarningText.innerHTML = "";
    changeForm.reset();
    changeDialog.close();
  } catch (error) {
    console.error("Error changing password:", error);
  }
});

// ============= Manage PW Function ============= //
const openManage = document.getElementById("open-manage");

openManage.addEventListener("click", function (event) {
  event.preventDefault();
  loadPasswords();
  document.getElementById("manage-dialog").showModal();
});

async function loadPasswords() {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch("http://127.0.0.1:8000/api/render-passwords", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to load passwords:", data.detail);
      return;
    }

    const tableDetailsContainer = document.getElementById("password-details");

    // Clear the placeholder text
    tableDetailsContainer.innerHTML = "";

    if (data.length === 0) {
      tableDetailsContainer.innerHTML =
        '<div style="padding: 12px; text-align: center; color: #888;">No passwords found.</div>';
    } else {
      // Loop through backend data and create rows
      data.forEach((pw) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "table-row-item";

        let showPassword = false;

        // Create elements safely instead of pure template strings so we can attach events
        rowDiv.innerHTML = `
          <div>${pw.name}</div>
          <div class="pw-text">********</div>
          <div><i class="fa-solid fa-eye toggle-eye" style="cursor: pointer;"></i></div>
        `;

        // Add interactive toggle functionality for the eye icon
        const eyeIcon = rowDiv.querySelector(".toggle-eye");
        const pwTextDiv = rowDiv.querySelector(".pw-text");

        eyeIcon.addEventListener("click", () => {
          showPassword = !showPassword;
          if (showPassword) {
            pwTextDiv.textContent = pw.password;
            eyeIcon.className = "fa-solid fa-eye-slash toggle-eye"; // Switch icon to hidden
          } else {
            pwTextDiv.textContent = "********";
            eyeIcon.className = "fa-solid fa-eye toggle-eye"; // Switch icon back to normal
          }
        });

        tableDetailsContainer.appendChild(rowDiv);
      });
    }
  } catch (error) {
    console.error("A network error occurred while loading passwords:", error);
  }
}

// ============= Themes And Interval Function ============= //
const applyBtn = document.getElementById("apply-changes");

applyBtn.addEventListener("click", function () {
  const selectedTheme = themesInput.value; // renamed, no shadowing
  const interval = intInput.value;

  theme = selectedTheme; // update the OUTER variable
  localStorage.setItem("theme", theme);

  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  if (interval === "daily") {
    currentIndex = 0;
  } else if (interval === "weekly") {
    currentIndex = 1;
  } else if (interval === "monthly") {
    currentIndex = 2;
  } else if (interval === "yearly") {
    currentIndex = 3;
  }

  localStorage.setItem("currentIndex", currentIndex);

  updateSlide();
  adjustCharts();
  console.log(theme, currentIndex);
  document.getElementById("settings-dialog").close();
});
