let currentIndex;
let theme = "";
let token = localStorage.getItem("authToken");
const apiURL = "https://finance-hub-qakq.onrender.com";
//"http://127.0.0.1:8000";
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
let dailyData = [];
let dailyTotal = 0.0;
let weeklyData = [];
let weeklyTotal = 0.0;
let monthlyData = [];
let monthlyTotal = 0.0;
let yearlyData = [];
let yearlyTotal = 0.0;

fetchAndRenderMainPage();

async function fetchAndRenderMainPage() {
  // Always read the latest auth token before the request is made.
  token = localStorage.getItem("authToken");
  if (!token || token === "undefined") {
    document.getElementById("login-dialog").showModal();
    return;
  }
  try {
    // 2. Fetch data from your Python API
    const response = await fetch(`${apiURL}/api/render_main_page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    if (!response.ok) {
      throw new Error("Server responded with status " + response.status);
    }

    // 3. Destructure into temporary constants without re-declaring global ones
    const responseData = await response.json();
    const walletData = responseData[0];
    const totalBalance = responseData[1];
    const transactionData = responseData[2];

    // 4. Update the Global variables directly (releasing them globally)
    dailyData = responseData[3];
    dailyTotal = responseData[4];
    weeklyData = responseData[5];
    weeklyTotal = responseData[6];
    monthlyData = responseData[7];
    monthlyTotal = responseData[8];
    yearlyData = responseData[9];
    yearlyTotal = responseData[10];

    // Update the total balance display
    document.getElementById("total-balance").textContent =
      `RM${totalBalance.toFixed(2)}`;
    renderWallets(walletData, "wallet-grid");
    renderTransactionTable(transactionData, "table-details");
    adjustRightPanel();
    updateSlide();
  } catch (error) {
    console.error("Failed to load wallets:", error);
  }
}

function renderWallets(walletData, walletGridId) {
  const grid = document.getElementById(walletGridId);

  if (!grid) {
    console.error(`renderWallets: grid "${walletGridId}" was not found.`);
    return;
  }

  grid.innerHTML = ""; // Clear any placeholders

  const template = document.getElementById("wallet-template");

  if (walletData.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #888;">
        No wallets found.
      </div>
    `;
  } else {
    walletData.forEach((wallet) => {
      const clone = template.content.cloneNode(true);

      const link = clone.querySelector(".view-btn");
      link.href = `wallets.html?id=${wallet.id}`;
      link.dataset.password = wallet.password;

      link.addEventListener("click", (e) => {
        if (wallet.password !== "") {
          e.preventDefault();
          const dialog = document.getElementById("access-dialog");
          dialog.dataset.link = `wallets.html?id=${wallet.id}`;
          dialog.dataset.password = wallet.password;

          document.getElementById("access-title").innerHTML =
            `"${wallet.name}" Wallet Is Locked! <i class="fa-solid fa-lock"></i>`;
          dialog.showModal();
        }
      });

      // Set the name & icon based on strict priority
      if (wallet.hide) {
        clone.querySelector(".name").innerHTML =
          `${wallet.name} <i class="fa-solid fa-eye-slash"></i>`;
      } else if (wallet.pin) {
        clone.querySelector(".name").innerHTML =
          `${wallet.name} <i class="fa-solid fa-thumbtack"></i>`;
      } else {
        clone.querySelector(".name").textContent = wallet.name;
      }

      clone.querySelector(".balance").textContent = `RM ${wallet.balance}`;

      // --- RENAME ACTION ---
      const renameLink = clone.querySelector(".rename-link");
      renameLink.addEventListener("click", (e) => {
        e.preventDefault();
        const dialog = document.getElementById("rename-dialog");
        const title = document.getElementById("rename-dialog-title");

        dialog.dataset.walletId = wallet.id;
        dialog.dataset.walletName = wallet.name;
        title.textContent = `Rename "${wallet.name}" Wallet`;
        dialog.showModal();
      });

      // --- DELETE ACTION ---
      const deleteLink = clone.querySelector(".delete-link");
      deleteLink.addEventListener("click", (e) => {
        e.preventDefault();
        const dialog = document.getElementById("delete-dialog");
        const title = document.getElementById("delete-dialog-title");

        dialog.dataset.walletId = wallet.id;
        dialog.dataset.walletName = wallet.name;
        title.textContent = `Delete "${wallet.name}" Wallet?`;
        dialog.showModal();
      });

      // --- LOCK / UNLOCK ACTION ---
      const lockLink = clone.querySelector(".lock-link");
      if (wallet.password !== "") {
        lockLink.innerHTML = '<i class="fa-solid fa-unlock"></i> Unlock';
      } else {
        lockLink.innerHTML = '<i class="fa-solid fa-lock"></i> Lock';
      }

      lockLink.addEventListener("click", (e) => {
        e.preventDefault();
        const dialog = document.getElementById("password-dialog");
        const title = document.getElementById("password-dialog-title");
        const saveButton = document.getElementById("btn-save");

        dialog.dataset.walletId = wallet.id;
        dialog.dataset.walletName = wallet.name;
        dialog.dataset.password = wallet.password;

        if (wallet.password !== "") {
          title.textContent = `Unlock "${wallet.name}" Wallet`;
          if (saveButton)
            saveButton.innerHTML =
              '<i class="fa-solid fa-unlock"></i> Unlock Wallet';
        } else {
          title.textContent = `Lock "${wallet.name}" Wallet`;
          if (saveButton)
            saveButton.innerHTML =
              '<i class="fa-solid fa-lock"></i> Lock Wallet';
        }
        dialog.showModal();
      });

      // --- CENSOR ACTION ---
      const censorLink = clone.querySelector(".censor-link");
      if (wallet.censor == false) {
        censorLink.innerHTML = '<i class="fa-solid fa-asterisk"></i> Censor';
      } else {
        censorLink.innerHTML =
          '<i class="fa-solid fa-dollar-sign"></i> Uncensor';
      }

      censorLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const response = await fetch(`${apiURL}/api/toggle/censor`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({
              wallet_id: wallet.id,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            alert(`Error: ${errorData.detail}`);
            return;
          }

          const data = await response.json();

          renderWallets(data.wallets, "wallet-grid");
          refreshWalletDialog();
        } catch (error) {
          console.error("Error updating wallet:", error);
          alert("An error occurred while saving. Please try again.");
        }
      });

      // --- HIDE ACTION ---
      const hideLink = clone.querySelector(".hide-link");

      if (wallet.hide == false) {
        hideLink.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide';
      } else {
        hideLink.innerHTML = '<i class="fa-solid fa-eye"></i> Unhide';
      }

      hideLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const response = await fetch(`${apiURL}/api/toggle/hide`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({
              wallet_id: wallet.id,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            alert(`Error: ${errorData.detail}`);
            return;
          }
          const data = await response.json();

          renderWallets(data.wallets, "wallet-grid");
          refreshWalletDialog();
        } catch (error) {
          console.error("Error updating wallet:", error);
          alert("An error occurred while saving. Please try again.");
        }
      });

      // --- PIN ACTION ---
      const pinLink = clone.querySelector(".pin-link");
      if (wallet.pin == false) {
        pinLink.innerHTML = '<i class="fa-solid fa-thumbtack"></i> Pin';
      } else {
        pinLink.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Unpin';
      }

      pinLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const response = await fetch(`${apiURL}/api/toggle/pin`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({
              wallet_id: wallet.id,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            alert(`Error: ${errorData.detail}`);
            return;
          }
          const data = await response.json();

          renderWallets(data.wallets, "wallet-grid");
          refreshWalletDialog();
        } catch (error) {
          console.error("Error updating wallet:", error);
          alert("An error occurred while saving. Please try again.");
        }
      });

      grid.appendChild(clone);
    });
    // Target all rendered wallet cards inside the grid
    const allWallets = grid.querySelectorAll(".wallet");

    allWallets.forEach((wallet) => {
      if (walletData.length > 3) {
        wallet.classList.add("wallet-fix");
      } else {
        wallet.classList.remove("wallet-fix");
      }
    });
  }
}

function renderTransactionTable(transactionData, tableContainer) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById(tableContainer);

  // Clear the placeholder text
  tableDetailsContainer.innerHTML = "";

  if (transactionData.length === 0) {
    tableDetailsContainer.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
  } else {
    // Loop through backend data and create rows
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
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>${amt}</div>
                <div>${tx.wallet_name || tx.wallet_id}</div>
            `;
      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}
function renderFilterTable(transactionData, tableContainer) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById(tableContainer);

  // Clear the placeholder text
  tableDetailsContainer.innerHTML = "";

  if (transactionData.length === 0) {
    tableDetailsContainer.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
  } else {
    // Loop through backend data and create rows
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
                <div>${tx.wallet_name || tx.wallet_id}</div>
            `;
      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}
// Keep track of the active chart instance outside the function
let activeExpenseChart = null;

function renderRightPanel(canvasData, metricsTotal) {
  const chartArea = document.getElementById("chart-area");

  if (!canvasData.labels || canvasData.labels.length === 0) {
    // If a chart already exists, destroy it before clearing the HTML area
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

  // Ensure the chart-area actually contains a canvas element
  // (re-creates it if it was previously overwritten by the "No data available" message)
  chartArea.innerHTML = '<canvas id="expenseChart"></canvas>';
  const ctx = document.getElementById("expenseChart").getContext("2d");

  // Destroy the previous chart instance if it exists
  if (activeExpenseChart) {
    activeExpenseChart.destroy();
  }

  // Define your color palettes
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

  // Choose colors dynamically based on your global 'theme' variable
  const currentColors = theme === "light" ? lightPalette : darkPalette;

  // Create the new chart and save the reference
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

  // Update Total Amount
  document.getElementById("metrics-amt").textContent =
    `RM${metricsTotal.toFixed(2)}`;
}
//====================== Dropdown Menu Function ======================//
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

//====================== Rename Function ======================//
const renameForm = document.getElementById("rename-form");
const renameDialog = document.getElementById("rename-dialog");
const newNameInput = document.getElementById("new-name");
const renameWarningText = document.getElementById("rename-warning-text");

// Make the submit event listener async so we can use await
renameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Grab dataset values HERE when the form is actually submitted
  const walletName = renameDialog.dataset.walletName;
  const walletId = renameDialog.dataset.walletId;

  // 1. Grab the value from input
  const newName = newNameInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  // 2. RUN YOUR JS PROCESSING / VALIDATION
  if (newName === "") {
    renameWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Name cannot be empty.';
    return;
  }

  if (newName === walletName) {
    renameWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This is already your current wallet name.';
    newNameInput.value = "";
    return;
  }

  // 3. POST TO BACKEND (via fetch)
  try {
    const response = await fetch(`${apiURL}/api/rename-wallet`, {
      // Point to your actual rename endpoint
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        walletId: walletId,
        newName: newName,
      }),
    });

    // 1. Check if the response failed (e.g., status 400 or 404)
    if (!response.ok) {
      const errorData = await response.json(); // Parses {"detail": "..."}
      renameWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      newNameInput.value = "";
      return;
    }
    const data = await response.json();
    renderWallets(data.wallets, "wallet-grid");
    refreshWalletDialog();
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }

  // 4. Clean up the input field for next time
  newNameInput.value = "";
  renameWarningText.innerHTML = "";
  renameDialog.close();
});

//====================== Delete Function ======================//
async function deleteWallet() {
  const deleteDialog = document.getElementById("delete-dialog");
  const deleteDialog2 = document.getElementById("delete-dialog2");
  const walletId = deleteDialog.dataset.walletId;
  try {
    // 2. Send the POST request to your FastAPI backend
    const response = await fetch(`${apiURL}/api/delete-wallet/` + walletId, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      alert(`Error: ${errorData.detail}`);
      return;
    }
    const data = await response.json();
    renderWallets(data.wallets, "wallet-grid");
    refreshWalletDialog();
    deleteDialog2.close();
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }
}

// ====================== Access Wallet Function ======================//
const accessDialog = document.getElementById("access-dialog");
const inputPassword = document.getElementById("access-wallet");
const accessWarningText = document.getElementById("access-warning-text");
const accessForm = document.getElementById("access-form");

inputPassword.addEventListener("input", () => {
  const password = inputPassword.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    accessWarningText.innerHTML = "";
    accessWarningText.style.color = ""; // Resets back to your default CSS color (red)
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    accessWarningText.style.color = ""; // Uses default CSS red
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    accessWarningText.style.color = "#10b981"; // Changes text color to green (Tailwind emerald-500)
  }
});

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const actualPassword = accessDialog.dataset.password;
  const walletPage = accessDialog.dataset.link;
  const enteredValue = inputPassword.value;

  // 1. Check length
  if (enteredValue.length < 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    inputPassword.value = "";
    return;
  }

  // 2. Check if password matches
  if (enteredValue === actualPassword) {
    accessWarningText.innerHTML = "";
    accessWarningText.style.color = "";
    inputPassword.value = "";
    accessDialog.close();

    window.location.href = walletPage;
  } else {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Incorrect password. Please try again.';
    accessWarningText.style.color = "";
    inputPassword.value = "";
    return;
  }
});

// ====================== Lock Function ======================//
const passwordForm = document.getElementById("password-form");
const lockWarningText = document.getElementById("lock-warning-text");
const passwordDialog = document.getElementById("password-dialog");
const passwordInput = document.getElementById("password");

passwordInput.addEventListener("input", () => {
  const password = passwordInput.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    lockWarningText.innerHTML = "";
    lockWarningText.style.color = "";
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    lockWarningText.style.color = "";
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    lockWarningText.style.color = "#10b981";
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const walletId = passwordDialog.dataset.walletId;
  const currentPasswordOnWallet = passwordDialog.dataset.password; // "" if unlocked, or active password if locked
  const password = passwordInput.value.trim();

  // 1. If the wallet is locked, verify the password matches first
  if (currentPasswordOnWallet !== "") {
    if (password.length < 8) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
      passwordInput.value = "";
      return;
    }
    if (password !== currentPasswordOnWallet) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Incorrect Password. Please try again.';
      passwordInput.value = "";
      return;
    }
  } else {
    // 2. If the wallet is unlocked (we are locking it), enforce the 8-character minimum
    if (password.length < 8) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
      passwordInput.value = "";
      return;
    }
  }

  // 3. Send the request to the backend once all checks pass
  try {
    const response = await fetch(`${apiURL}/api/lock-wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        walletId: walletId,
        password: password,
        token: token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      lockWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      passwordInput.value = "";
      return;
    }
    const data = await response.json();
    renderWallets(data.wallets, "wallet-grid");
    refreshWalletDialog();
    // 4. Cleanup and reload page on success
    lockWarningText.innerHTML = "";
    passwordInput.value = "";
    passwordDialog.close();
  } catch (error) {
    console.error("Error updating wallet lock status:", error);
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> An error occurred. Please try again.';
  }
});

// ====================== Create Function ======================//
const createForm = document.getElementById("create-form");
const createDialog = document.getElementById("create-dialog");
const newWalletInput = document.getElementById("new-wallet");
const createWarningText = document.getElementById("create-warning-text");

// Make the submit event listener async so we can use await
createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // 1. Grab the value from input
  const walletName = newWalletInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  // 2. RUN YOUR JS PROCESSING / VALIDATION
  if (walletName === "") {
    createWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Name cannot be empty.';
    return;
  }

  // 3. POST TO BACKEND (via fetch)
  try {
    const response = await fetch(`${apiURL}/api/create-wallet/${walletName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
    // 1. Check if the response failed (e.g., status 400 or 404)
    if (!response.ok) {
      const errorData = await response.json(); // Parses {"detail": "..."}
      createWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      newWalletInput.value = "";
      return;
    }
    const data = await response.json();
    renderWallets(data.wallets, "wallet-grid");
    refreshWalletDialog();
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }

  // 4. Clean up the input field for next time
  newWalletInput.value = "";
  createWarningText.innerHTML = "";
  createDialog.close();
});

// ====================== Metrics Function ======================//
// 1. Target your sliding elements and arrow divs
const wrapper = document.getElementById("view-wrapper");
const wrapper2 = document.getElementById("view-wrapper2");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// 3. Handle Left Arrow click
prevBtn.addEventListener("click", async () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateSlide();
    adjustRightPanel();
  }
});

// 4. Handle Right Arrow click
nextBtn.addEventListener("click", async () => {
  if (currentIndex < 3) {
    currentIndex++;
    updateSlide();
    adjustRightPanel();
  }
});

// 5. Update slider position and get active value
function updateSlide() {
  const percentage = -currentIndex * 25;
  wrapper.style.transform = `translateX(${percentage}%)`;
  wrapper2.style.transform = `translateX(${percentage}%)`;

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

function adjustRightPanel() {
  if (currentIndex === 0) {
    renderRightPanel(dailyData, dailyTotal);
  } else if (currentIndex === 1) {
    renderRightPanel(weeklyData, weeklyTotal);
  } else if (currentIndex === 2) {
    renderRightPanel(monthlyData, monthlyTotal);
  } else if (currentIndex === 3) {
    renderRightPanel(yearlyData, yearlyTotal);
  } else {
    // Fixed: Replaced Python string formatting with JavaScript template literal
    console.error(`Error: Invalid currentIndex of ${currentIndex}`);
    alert(`Error: Invalid slide index (${currentIndex})`);
  }
}

// ====================== Register Function ======================//
const registerForm = document.getElementById("register-form");
const remailWarningText = document.getElementById(
  "register-email-warning-text",
);
const rpwWarningText = document.getElementById(
  "register-password-warning-text",
);
const registerDialog = document.getElementById("register-dialog");
const remailInput = document.getElementById("register-email");
const rpasswordInput = document.getElementById("register-password");

registerDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
  }
});

rpasswordInput.addEventListener("input", () => {
  const password = rpasswordInput.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    rpwWarningText.innerHTML = "";
    rpwWarningText.style.color = "";
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    rpwWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    rpwWarningText.style.color = "";
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    rpwWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    rpwWarningText.style.color = "#10b981";
  }
});
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = remailInput.value.trim();
  const password = rpasswordInput.value.trim();

  // 1. Validate email field
  if (email.length === 0) {
    remailWarningText.style.color = "";
    remailWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    rpwWarningText.innerHTML = "";
    return;
  }

  // 2. Validate password length
  if (password.length < 8) {
    rpwWarningText.style.color = "";
    rpwWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    rpasswordInput.value = "";
    remailWarningText.innerHTML = "";
    return;
  }

  // 3. Send registration request to backend
  try {
    const response = await fetch(`${apiURL}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Show backend error (e.g., unauthorized email whitelist, or user already exists)
      remailWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      remailInput.value = "";
      rpwWarningText.innerHTML = "";
      rpasswordInput.value = "";
      return;
    }

    const data = await response.json();
    // --- STORE THE AUTH TOKEN HERE ---
    // (Make sure "access_token" matches whatever key your FastAPI backend returns)
    localStorage.setItem("authToken", data.access_token);
    token = data.access_token;
    // 4. Success handling (Clear form and redirect to login or dashboard)
    if (response) {
      remailWarningText.innerHTML = "";
      rpwWarningText.innerHTML = "";
      remailInput.value = "";
      rpasswordInput.value = "";
      fetchAndRenderMainPage();
      registerDialog.close();
    }
  } catch (error) {
    console.error("Error during registration:", error);
    remailWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> An error occurred. Please try again.';
  }
});

/// ====================== Login Function ======================//
const loginForm = document.getElementById("login-form");
const lemailWarningText = document.getElementById("login-email-warning-text");
const lpwWarningText = document.getElementById("login-password-warning-text");
const loginDialog = document.getElementById("login-dialog");
const lemailInput = document.getElementById("login-email");
const lpasswordInput = document.getElementById("login-password");

loginDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
  }
});

lpasswordInput.addEventListener("input", () => {
  const password = lpasswordInput.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    lpwWarningText.innerHTML = "";
    lpwWarningText.style.color = "";
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    lpwWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    lpwWarningText.style.color = "";
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    lpwWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    lpwWarningText.style.color = "#10b981";
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = lemailInput.value.trim();
  const password = lpasswordInput.value.trim();

  // 1. Validate email field
  if (email.length === 0) {
    lemailWarningText.style.color = "";
    lemailWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This field is required.';
    lpwWarningText.innerHTML = "";
    return;
  }

  // 2. Validate password length
  if (password.length < 8) {
    lpwWarningText.style.color = "";
    lpwWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    lpasswordInput.value = "";
    lemailWarningText.innerHTML = "";
    return;
  }

  // 3. Send login request to backend
  try {
    const response = await fetch(`${apiURL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Check the error status properly
      const statusCode = response.status || data.status;

      if (statusCode === 400) {
        lemailWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.detail}`;
        lemailInput.value = "";
        lpwWarningText.innerHTML = "";
        lpasswordInput.value = "";
        return;
      }

      if (statusCode === 401) {
        lpwWarningText.style.color = "";
        lpwWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.detail}`;
        lemailWarningText.innerHTML = "";
        lpasswordInput.value = "";
        return;
      }
    }

    // --- STORE THE AUTH TOKEN HERE ---
    localStorage.setItem("authToken", data.access_token);
    token = data.access_token;

    // 4. Success handling (Clear form)
    if (response) {
      lemailWarningText.innerHTML = "";
      lpwWarningText.innerHTML = "";
      lemailInput.value = "";
      lpasswordInput.value = "";
      fetchAndRenderMainPage();
      loginDialog.close();
    }
  } catch (error) {
    console.error("Error during login:", error);
    lemailWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> An error occurred. Please try again.';
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

    const response = await fetch(`${apiURL}/api/render-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to fetch settings:", data.detail);
      return;
    }

    // Extract values from the backend response dictionary
    const email = data.email;
    const pfp = data.profile_picture;

    // Update settings UI elements
    document.getElementById("settings-email").textContent = email;

    const pfpElement = document.getElementById("settings-pfp");

    pfpElement.src = `${apiURL}/uploads/` + pfp;

    if (token) {
      const whiteList = document.getElementById("whitelist-box");
      const close = document.getElementById("close");

      // Paste your exact expected token here
      const myToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZkYzY5MDVlLTE0ODUtNDEzMy1hOTc3LTg1ODMzZGVhMjcwZCJ9.DesGgnUptrCX4Q9VFs3Rg69JXxTh693Fc6ecOrz1MAk";

      if (!token || token.trim() !== myToken) {
        whiteList.classList.add("hidden"); // Hide it if it's not yours or missing
        close.classList.add("adjust");
      } else {
        whiteList.classList.remove("hidden"); // Show it only if it's an exact match
        close.classList.remove("adjust");
      }
    }

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

    const response = await fetch(`${apiURL}/api/change-password`, {
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

    const response = await fetch(`${apiURL}/api/render-passwords`, {
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
        '<div style="padding: 12px; text-align: center; color: #888;">No locked wallets found.</div>';
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
  adjustRightPanel();
  console.log(theme, currentIndex);
  document.getElementById("settings-dialog").close();
});

// ============= View All Wallets Function ============= //
const viewAllBtn = document.getElementById("view-all-wallets");
const walletsDialog = document.getElementById("wallets-dialog");

viewAllBtn.addEventListener("click", async function () {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }
    const response = await fetch(`${apiURL}/api/load-wallets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to load wallets:", data.detail);
      return;
    }

    // Make sure you render your wallets here before opening the dialog
    renderWallets(data, "all-wallets-grid");
    walletsDialog.showModal();
  } catch (error) {
    console.error("A network error occurred while loading wallets:", error);
  }
});

async function refreshWalletDialog() {
  const walletsDialog = document.getElementById("wallets-dialog");

  if (!walletsDialog || !walletsDialog.open) {
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      document.getElementById("login-dialog").showModal();
      return;
    }

    const response = await fetch(`${apiURL}/api/load-wallets`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to load wallets:", data.detail);
      return;
    }

    renderWallets(data, "all-wallets-grid");
  } catch (error) {
    console.error("A network error occurred while loading wallets:", error);
  }
}

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
const inputWalletFilter = document.getElementById("filter-wallet");

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
  const wallet = inputWalletFilter.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  try {
    const response = await fetch(`${apiURL}/api/get-filter/` + "main", {
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
        wallet: wallet || null,
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

// ============= Whitelist Function ============= //
const whitelistBtn = document.getElementById("whitelist-btn");
const whitelistEmail = document.getElementById("whitelist-email");

whitelistBtn.addEventListener("click", async function () {
  event.preventDefault();
  // 1. Added async here
  const email = whitelistEmail.value.trim();

  if (!email) {
    alert("Please enter an email address.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address format.");
    return;
  }

  try {
    const response = await fetch(`${apiURL}/api/whitelist-email/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: email }), // 2. Added body so backend receives the email
    });

    if (!response.ok) {
      const data = await response.json(); // Added parentheses ()
      alert(`${data.detail}`); // Wrapped in backticks ``
      return;
    }

    alert("Email Successfully Whitelisted!");
    whitelistEmail.value = "";
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to whitelist email.");
  }
});
