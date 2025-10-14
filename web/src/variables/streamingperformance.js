// ✅ Colors for the chart
const colors = {
  gray: {
    100: "#f6f9fc",
    200: "#e9ecef",
    300: "#dee2e6",
    400: "#ced4da",
    500: "#adb5bd",
    600: "#8898aa",
    700: "#525f7f",
    800: "#32325d",
    900: "#212529"
  },
  theme: {
    default: "#172b4d",
    primary: "#5e72e4",
    secondary: "#f4f5f7",
    info: "#11cdef",
    success: "#2dce89",
    danger: "#f5365c",
    warning: "#fb6340"
  },
  black: "#12263F",
  white: "#FFFFFF",
  transparent: "transparent"
};

// ✅ Function to calculate max Y-axis
function calculateMaxY(data) {
  const maxValue = Math.max(...data.flat());
  return Math.ceil((maxValue + 10000000) / 5000000) * 5000000;
}

const chartData = {
  labels: ["Oct '24", "Nov '24", "Dec '24", "Jan '25", "Feb '25"],
  datasets: [
    {
      label: "YouTube UGC",
      data: [2174838, 5140802, 12890241, 15306002, 10040998],
      borderColor: "#FF0000",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#FF0000",
      pointBorderColor: "#fff"
    },
    {
      label: "Spotify",
      data: [0, 46187, 286360, 338490, 346982],
      borderColor: "#1DB954",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#1DB954",
      pointBorderColor: "#fff"
    },
    {
      label: "Apple Music",
      data: [0, 608, 2019, 2683, 2385],
      borderColor: "#f5365c",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#f5365c",
      pointBorderColor: "#fff"
    },
    {
      label: "Amazon Prime",
      data: [0, 502, 2627, 3273, 2993],
      borderColor: "#68ccd5",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#68ccd5",
      pointBorderColor: "#fff"
    },
    {
      label: "Amazon Unlimited",
      data: [0, 2997, 10223, 16402, 14391],
      borderColor: "#4200ff",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#4200ff",
      pointBorderColor: "#fff"
    },
    {
      label: "Pandora",
      data: [0, 19, 80, 66, 97],
      borderColor: "#fd34b4",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#fd34b4",
      pointBorderColor: "#fff"
    },
    {
      label: "Deezer",
      data: [0, 43, 116, 129, 95],
      borderColor: "#a238ff",
      fill: true,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: "#a238ff",
      pointBorderColor: "#fff"
    }
  ]
};

const maxYValue = calculateMaxY(chartData.datasets.map(d => d.data));

// ✅ Final Chart Configuration
const chartStreamingPerformance = {
  data: chartData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: {
          display: true,
          text: "STREAMS",
          color: colors.gray[600],
          font: {
            size: 14
          },
          padding: 10
        },
        beginAtZero: true,
        ticks: {
          stepSize: 5000000,
          max: maxYValue,
          callback: value => value / 1000000 + "M",
          color: colors.gray[700]
        },
        grid: {
          color: colors.gray[200]
        }
      },
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          minRotation: 0,
          font: {
            size: 14
          },
          padding: 15,
          color: colors.gray[700]
        },
        grid: {
          drawTicks: false,
          color: colors.gray[300]
        }
      }
    },
    plugins: {
      tooltip: {
        enabled: false
      },
      legend: {
        display: false
      }
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    elements: {
      point: {
        radius: 6,
        hoverRadius: 8,
        borderWidth: 2,
        borderColor: "#fff"
      }
    }
  }
};


// ✅ Utility
function chartOptions() {
  return {}; // Chart options now fully handled in the config
}

function parseOptions(parent, options) {
  for (let item in options) {
    if (typeof options[item] !== "object") {
      parent[item] = options[item];
    } else {
      parseOptions(parent[item], options[item]);
    }
  }
}

export { chartStreamingPerformance, chartOptions, parseOptions };
