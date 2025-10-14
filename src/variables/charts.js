import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement
} from 'chart.js';

Chart.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement
);

// Utility for demo data

// Global colors and settings
const colors = {
  theme: {
    default: "#172b4d",
    primary: "#5e72e4",
    secondary: "#f4f5f7",
    info: "#11cdef",
    success: "#2dce89",
    danger: "#f5365c",
    warning: "#fb6340",
  },
  gray: {
    200: "#e9ecef",
    300: "#dee2e6",
    700: "#525f7f",
  },
  white: "#FFFFFF",
  transparent: "transparent"
};

// Rounded bars plugin (for v3+)
const roundedBarsPlugin = {
  id: 'roundedBars',
  beforeDatasetsDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, index) => {
        const { x, y, base, width, height } = bar.getProps(['x', 'y', 'base', 'width', 'height'], true);
        const radius = Math.min(6, Math.abs(height) / 2, width / 2);
        const left = x - width / 2;
        const right = x + width / 2;
        const top = y;
        const bottom = base;

        ctx.save();

        // ✅ Safe backgroundColor assignment
        ctx.fillStyle = Array.isArray(dataset.backgroundColor)
          ? dataset.backgroundColor[index] || '#000'
          : dataset.backgroundColor || '#000';

        ctx.beginPath();
        ctx.moveTo(left + radius, top);
        ctx.lineTo(right - radius, top);
        ctx.quadraticCurveTo(right, top, right, top + radius);
        ctx.lineTo(right, bottom - radius);
        ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
        ctx.lineTo(left + radius, bottom);
        ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
        ctx.lineTo(left, top + radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
        ctx.fill();

        ctx.restore();
      });
    });
  }
};


Chart.register(roundedBarsPlugin);

// Global config setup
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 16,
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
    }
  },
  scales: {
  x: {
    grid: {
      drawBorder: false,
      drawOnChartArea: false,
      drawTicks: false
    },
    ticks: {
      padding: 20
    }
  },
  y: {
    beginAtZero: true,
    ticks: {
      callback: function (value) {
        if (!(value % 10)) {
          return "$" + value + "k";
        }
      }
    },
    grid: {
      borderDash: [2],
      borderDashOffset: 2
    }
  }
}

};

// Optional helper to deep-merge config
const parseOptions = (parent, options) => {
  for (let item in options) {
    if (typeof options[item] !== 'object' || Array.isArray(options[item])) {
      parent[item] = options[item];
    } else {
      parseOptions(parent[item], options[item]);
    }
  }
};

// Example dataset
const chartExample1 = {
  options: chartOptions,
  data: {
    labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Performance",
        data: [10, 30, 20, 50, 40, 60, 70, 90],
        backgroundColor: colors.theme.primary,
        borderRadius: 6,
        maxBarThickness: 12
      }
    ]
  }
};

const chartExample2 = {
  options: chartOptions,
  data: {
    labels: ["A", "B", "C", "D", "E", "F", "G"],
    datasets: [
      {
        label: "Sales",
        data: [25, 20, 30, 22, 17, 29, 35],
        backgroundColor: colors.theme.success,
        borderRadius: 6,
        maxBarThickness: 10
      }
    ]
  }
};

// More chartExampleX can follow the same pattern...

export {
  chartOptions,
  parseOptions,
  chartExample1,
  chartExample2
};
