import React, { useState, useEffect } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  MoreHorizontal,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  PieChart,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Cell,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Pie,
} from "recharts";

const queryClient = new QueryClient();

// Background styles
const backgroundStyles = `
.animated-bg {
  background: linear-gradient(45deg, #0f172a, #1e293b, #334155);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  position: relative;
  overflow: hidden;
}

.animated-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, #1e40af20, #7c3aed20, #059669-20);
  opacity: 0.3;
  animation: gradientMove 20s ease-in-out infinite;
  pointer-events: none;
}

.animated-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    radial-gradient(2px 2px at 20px 30px, rgba(96, 165, 250, 0.3), transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(52, 211, 153, 0.3), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(251, 191, 36, 0.3), transparent),
    radial-gradient(1px 1px at 130px 80px, rgba(167, 139, 250, 0.3), transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
  animation: particleMove 25s linear infinite;
  pointer-events: none;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes gradientMove {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(30px, -30px) rotate(120deg); }
  66% { transform: translate(-20px, 20px) rotate(240deg); }
}

@keyframes particleMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(-200px, -100px); }
}

.glass-card {
  backdrop-filter: blur(10px);
  background: rgba(26, 32, 44, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glow-text {
  text-shadow: 0 0 10px rgba(96, 165, 250, 0.3);
}

.glow-button:hover {
  box-shadow: 0 0 20px rgba(96, 165, 250, 0.4);
}

.hover-lift {
  transition: transform 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-2px);
}
`;

function LiveDataDashboard() {
  const [countdown, setCountdown] = useState(30);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch Google Sheet data
  const {
    data: sheetData = [],
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["sheetData"],
    queryFn: async () => {
      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbxT_VzkKxpOVgzvSpXf-ksaZ7mhPBEKORV4cnAOIPMYwbMmfUl0239W_rrT20NbIwX9HA/exec"
      );
      if (!res.ok) throw new Error("Network response was not ok");

      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 3,
  });

  // Countdown timer for next refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Reset countdown when data updates and handle errors
  useEffect(() => {
    setCountdown(30);
    if (dataUpdatedAt) {
      setErrorMessage("");
    }
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (error) {
      setErrorMessage(error.message || "Failed to fetch spreadsheet data");
    } else {
      setErrorMessage("");
    }
  }, [error]);

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return "Never";
    const now = new Date();
    const updated = new Date(timestamp);
    const diffInSeconds = Math.floor((now - updated) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else {
      return updated.toLocaleTimeString();
    }
  };

  const handleManualRefresh = () => {
    refetch();
    setCountdown(30);
  };

  const getConnectionStatus = () => {
    if (isLoading)
      return { color: "#F59E0B", text: "Loading", icon: RefreshCw };
    if (error) return { color: "#EF4444", text: "Error", icon: WifiOff };
    return { color: "#10B981", text: "Connected", icon: Wifi };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  // Function to determine week number based on day of month
  const getWeekFromDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      const day = date.getDate();
      
      if (day <= 7) return 'Week 1';
      if (day <= 14) return 'Week 2';
      if (day <= 21) return 'Week 3';
      if (day <= 28) return 'Week 4';
      return 'Week 5';
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Chart data processing
  const processDataForCharts = (data) => {
    if (!data || data.length === 0) return { 
      barCharts: [],
      lineCharts: [],
      mtbfChart: { title: "MTBF Trend", data: [], key: "mtbf-trend" },
      pieCharts: [],
      yAxisMax: 10
    };
    
    // Process data by calendar weeks
    const processedData = data.reduce((acc, item) => {
      const dateField = Object.keys(item).find(key => 
        key.toLowerCase() === 'date' || 
        (typeof item[key] === 'string' && item[key].match(/^\d{4}-\d{2}-\d{2}/))
      );
      
      const week = dateField ? getWeekFromDate(item[dateField]) : null;
      if (!week) return acc;
      
      if (!acc[week]) {
        acc[week] = {
          week,
          IMM: 0,
          SPM: 0,
          ASSY: 0,
          IMM_downtime: 0,
          SPM_downtime: 0,
          ASSY_downtime: 0,
          IMM_uptime: 0,
          SPM_uptime: 0,
          ASSY_uptime: 0,
          causes: {},
          causesByCategory: { IMM: {}, SPM: {}, ASSY: {} },
        };
      }
      
      let category = null;
      const machineCategoryField = Object.keys(item).find(key => 
        key === 'Machine↵Category' || 
        key.toLowerCase().includes('machine category') || 
        key.toLowerCase().includes('category')
      );

      if (machineCategoryField && item[machineCategoryField]) {
        category = item[machineCategoryField].toUpperCase();
        if (category === 'ASSLY') {
          category = 'ASSY';
        }
      }
      
      const breakdownTypeField = Object.keys(item).find(key =>
        key.toLowerCase().includes('service request / breakdown') ||
        key.toLowerCase().includes('breakdown type') ||
        key.toLowerCase().includes('category (service request / breakdown)')
      );
      const isBreakdown = breakdownTypeField && 
        item[breakdownTypeField].toLowerCase().includes('breakdown');

      if (category && isBreakdown) {
        if (category.includes('IMM')) {
          acc[week].IMM++;
        } else if (category.includes('SPM')) {
          acc[week].SPM++;
        } else if (category.includes('ASSY')) {
          acc[week].ASSY++;
        }
        
        const downtimeField = Object.keys(item).find(key => {
  const lowerKey = key.toLowerCase();
  return (
    (lowerKey.includes("total down time") ||   // ✅ exact match for your sheet
     lowerKey.includes("repair time") ||
     lowerKey.includes("bd time") ||
     lowerKey.includes("breakdown time") ||
     lowerKey.includes("downtime")) &&
    !lowerKey.includes("category")             // 🚫 avoid DOWNTIME CATEGORY
  );
});


if (downtimeField) {
  const downtime = parseFloat(item[downtimeField]) || 0;

  // 👇 Debug log
  console.log("Parsed downtime:", downtime, "from field:", downtimeField, "row:", item);

  if (category.includes('IMM')) {
    acc[week].IMM_downtime += downtime;
  } else if (category.includes('SPM')) {
    acc[week].SPM_downtime += downtime;
  } else if (category.includes('ASSY')) {
    acc[week].ASSY_downtime += downtime;
  }
} else {
  // 👇 Debug log if no field found
  console.warn("No downtime field found in row:", item);
}

        
        const uptimeField = Object.keys(item).find(key => 
          key.toLowerCase().includes('uptime') || 
          key.toLowerCase().includes('operating time')
        );
        
        if (uptimeField) {
          const uptime = parseFloat(item[uptimeField]) || 0;
          if (category.includes('IMM')) {
            acc[week].IMM_uptime += uptime;
          } else if (category.includes('SPM')) {
            acc[week].SPM_uptime += uptime;
          } else if (category.includes('ASSY')) {
            acc[week].ASSY_uptime += uptime;
          }
        }
        
        const causeField = Object.keys(item).find(key =>
          key.toLowerCase().includes('cause') ||
          key.toLowerCase().includes('reason') ||
          key.toLowerCase().includes('failure') ||
          key.toLowerCase().includes('downtime category')
        );
        
        if (causeField && item[causeField]) {
          const cause = item[causeField];
          if (!acc[week].causes[cause]) acc[week].causes[cause] = 0;
          acc[week].causes[cause]++;

          if (category.includes("IMM")) {
            acc[week].causesByCategory.IMM[cause] =
              (acc[week].causesByCategory.IMM[cause] || 0) + 1;
          } else if (category.includes("SPM")) {
            acc[week].causesByCategory.SPM[cause] =
              (acc[week].causesByCategory.SPM[cause] || 0) + 1;
          } else if (category.includes("ASSY")) {
            acc[week].causesByCategory.ASSY[cause] =
              (acc[week].causesByCategory.ASSY[cause] || 0) + 1;
          }
        }
      }
      
      return acc;
    }, {});
    
    const weeklyData = Object.values(processedData).map(week => {
      const IMM_MTTR = week.IMM > 0 ? (week.IMM_downtime / week.IMM) : 0;
      const SPM_MTTR = week.SPM > 0 ? (week.SPM_downtime / week.SPM) : 0;
      const ASSY_MTTR = week.ASSY > 0 ? (week.ASSY_downtime / week.ASSY) : 0;

      const totalBreakdowns = week.IMM + week.SPM + week.ASSY;
      const totalDowntime = week.IMM_downtime + week.SPM_downtime + week.ASSY_downtime;
      const MTTR = totalBreakdowns > 0 ? (totalDowntime / totalBreakdowns) : 0;

      const totalUptime = week.IMM_uptime + week.SPM_uptime + week.ASSY_uptime;
      const MTBF = totalBreakdowns > 0 ? (totalUptime / totalBreakdowns) : 0;

      return {
        ...week,
        IMM_MTTR,
        SPM_MTTR,
        ASSY_MTTR,
        MTTR,
        MTBF,
        IMM_MTTR_formatted: `${IMM_MTTR.toFixed(2)} min/BD`,
        SPM_MTTR_formatted: `${SPM_MTTR.toFixed(2)} min/BD`,
        ASSY_MTTR_formatted: `${ASSY_MTTR.toFixed(2)} min/BD`,
        MTTR_formatted: `${MTTR.toFixed(2)} min/BD`,
        MTBF_formatted: `${MTBF.toFixed(2)} min/BD`,
      };
    });

    weeklyData.sort((a, b) => {
      const weekA = parseInt(a.week.replace("Week ", ""), 10);
      const weekB = parseInt(b.week.replace("Week ", ""), 10);
      return weekA - weekB;
    });

    const maxBreakdownCount = Math.max(
      ...weeklyData.map(item => item.IMM + item.SPM + item.ASSY),
      10
    );
    const maxYAxisValue = Math.ceil(maxBreakdownCount / 5) * 5;
    
    const barCharts = [
      {
        title: "Overall Plant B/D",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.IMM + item.SPM + item.ASSY,
          IMM: item.IMM,
          SPM: item.SPM,
          ASSY: item.ASSY
        })),
        key: "overall-bd",
        isOverallChart: true
      },
      {
        title: "IMM B/D",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.IMM
        })),
        key: "imm-bd"
      },
      {
        title: "SPM B/D",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.SPM
        })),
        key: "spm-bd"
      },
      {
        title: "ASSY B/D",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.ASSY
        })),
        key: "assy-bd"
      }
    ];

    const maxMTTR = Math.max(
      ...weeklyData.map(item => Math.max(item.MTTR, item.IMM_MTTR, item.SPM_MTTR, item.ASSY_MTTR)),
      10
    );
    const mttrYAxisMax = Math.ceil(maxMTTR / 10) * 10;

    const lineCharts = [
      {
        title: "Overall MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.MTTR,
          formattedValue: item.MTTR_formatted
        })),
        key: "overall-mttr",
        yAxisMax: mttrYAxisMax
      },
      {
        title: "IMM MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.IMM_MTTR,
          formattedValue: item.IMM_MTTR_formatted
        })),
        key: "imm-mttr",
        yAxisMax: mttrYAxisMax
      },
      {
        title: "SPM MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.SPM_MTTR,
          formattedValue: item.SPM_MTTR_formatted
        })),
        key: "spm-mttr",
        yAxisMax: mttrYAxisMax
      },
      {
        title: "ASSY MTTR",
        data: weeklyData.map(item => ({
          name: item.week,
          value: item.ASSY_MTTR,
          formattedValue: item.ASSY_MTTR_formatted
        })),
        key: "assy-mttr",
        yAxisMax: mttrYAxisMax
      }
    ];

    const mtbfChart = {
      title: "MTBF Trend",
      data: weeklyData.map(item => ({
        name: item.week,
        value: item.MTBF,
        formattedValue: item.MTBF_formatted
      })),
      key: "mtbf-trend"
    };

    const pieCharts = [];
    const plantCauses = {};
    data.forEach(item => {
      const breakdownTypeField = Object.keys(item).find(key =>
        key.toLowerCase().includes('service request / breakdown') ||
        key.toLowerCase().includes('breakdown type') ||
        key.toLowerCase().includes('category (service request / breakdown)')
      );
      const isBreakdown = breakdownTypeField && 
        item[breakdownTypeField].toLowerCase().includes('breakdown');
      
      if (isBreakdown) {
        const causeField = Object.keys(item).find(key =>
          key.toLowerCase().includes('cause') ||
          key.toLowerCase().includes('downtime category')
        );
        const downtimeField = Object.keys(item).find(key => 
          key.toLowerCase().includes('total down time')
        );
        
        if (causeField && downtimeField) {
          const cause = item[causeField]?.trim() || "Unknown";
          const minutes = parseFloat(item[downtimeField] || 0);
          plantCauses[cause] = (plantCauses[cause] || 0) + minutes;
        }
      }
    });

    const topPlantCauses = Object.entries(plantCauses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));

    pieCharts.push({
      title: "Plant Top 3 B/D",
      data: topPlantCauses,
      key: "plant-top"
    });

    ["IMM", "SPM", "ASSY"].forEach(cat => {
      const catCauses = {};
      weeklyData.forEach(week => {
        Object.entries(week.causesByCategory?.[cat] || {}).forEach(([cause, count]) => {
          catCauses[cause] = (catCauses[cause] || 0) + count;
        });
      });
      const topCatCauses = Object.entries(catCauses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, value]) => ({ name, value }));
      pieCharts.push({ 
        title: `${cat} Top 3 B/D`, 
        data: topCatCauses, 
        key: `${cat.toLowerCase()}-top` 
      });
    });

    return { barCharts, lineCharts, mtbfChart, pieCharts, yAxisMax: maxYAxisValue };
  };

  const { barCharts, lineCharts, mtbfChart, pieCharts, yAxisMax } = processDataForCharts(sheetData);

  const COLORS = [
    "#60A5FA", "#34D399", "#FBBF24", "#F87171",
    "#A78BFA", "#6EE7B7", "#FCD34D", "#93C5FD",
    "#FB923C", "#4ADE80", "#F472B6", "#38BDF8",
  ];

  return (
    <div className="min-h-screen bg-[#121212] animated-bg">
      <style>{backgroundStyles}</style>
      <div className="animated-gradient"></div>
      <div className="animated-particles"></div>
      <div className="mx-auto max-w-7xl p-6 md:p-10 relative z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-white glow-text">
              IAC Maintenance Live Data Dashboard
            </h1>
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D3748] hover:bg-[#4A5568] border border-gray-700 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 glow-button"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between p-4 bg-[#1A202C] border border-gray-700 rounded-lg glass-card">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  style={{ color: status.color }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: status.color }}
                >
                  {status.text}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#A0AEC0]">
                <Clock className="w-4 h-4" />
                Last updated: {formatLastUpdated(dataUpdatedAt)}
              </div>
            </div>
            <div className="text-sm text-[#A0AEC0]">
              Next refresh in: {countdown}s
            </div>
          </div>
        </div>
        
        {/* Error State */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg glass-card">
            <div className="flex items-center gap-2 text-red-400">
              <WifiOff className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-300 text-sm mt-1">{errorMessage}</p>
            <button
              onClick={handleManualRefresh}
              className="mt-3 text-red-400 text-sm font-medium hover:text-red-300 glow-text"
            >
              Try again
            </button>
          </div>
        )}

        {/* Charts Section */}
        {sheetData.length > 0 && (
          <div className="space-y-8 mb-6">
            {/* Row 1: Bar Charts */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">Breakdown Data</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {barCharts.map((chart, index) => (
                  <div
                    key={chart.key}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-[#A0AEC0]" />
                      <h3 className="text-sm font-semibold text-white glow-text">
                        {chart.title}
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <RechartsBarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                        <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
                        <YAxis
                          tick={{fill: '#A0AEC0', fontSize: 10}}
                          domain={[0, yAxisMax]}
                          ticks={Array.from({length: 6}, (_, i) => Math.round(i * yAxisMax / 5))}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#2D3748',
                            border: '1px solid #4A5568',
                            borderRadius: '6px',
                            color: '#E2E8F0',
                            fontSize: '12px',
                            padding: '8px 12px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              if (chart.isOverallChart) {
                                return (
                                  <div style={{
                                    backgroundColor: '#2D3748',
                                    border: '1px solid #4A5568',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    color: '#E2E8F0',
                                  }}>
                                    <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{label}</p>
                                    <p style={{ margin: '2px 0', color: '#60A5FA' }}>
                                      Total: {data.IMM + data.SPM + data.ASSY}
                                    </p>
                                    <div style={{ fontSize: '11px', color: '#A0AEC0' }}>
                                      <div>IMM: {data.IMM}</div>
                                      <div>SPM: {data.SPM}</div>
                                      <div>ASSY: {data.ASSY}</div>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div style={{
                                  backgroundColor: '#2D3748',
                                  border: '1px solid #4A5568',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  color: '#E2E8F0',
                                }}>
                                  <p>{label}: {Math.round(data.value)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill={COLORS[index % COLORS.length]} 
                          barSize={20} 
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: MTTR Charts */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">MTTR Trends</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {lineCharts.map((chart, index) => (
                  <div
                    key={chart.key}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-[#A0AEC0]" />
                      <h3 className="text-sm font-semibold text-white glow-text">
                        {chart.title}
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
  <LineChart data={chart.data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
    <XAxis dataKey="name" tick={{ fill: '#A0AEC0', fontSize: 10 }} />
    <YAxis tick={{ fill: '#A0AEC0', fontSize: 10 }} domain={[0, 'dataMax + 10']} />
    <Tooltip
      contentStyle={{
        backgroundColor: '#2D3748',
        border: '1px solid #4A5568',
        borderRadius: '6px',
        color: '#E2E8F0',
      }}
      formatter={(value, name, props) => [
        props.payload.formattedValue, chart.title
      ]}
    />
    <Line
      type="monotone"
      dataKey="value"
      stroke={COLORS[index % COLORS.length]}
      strokeWidth={2}
      dot={{ r: 3, fill: COLORS[index % COLORS.length], strokeWidth: 1 }}
      activeDot={{ r: 5 }}
    />
  </LineChart>
</ResponsiveContainer>

                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: MTBF Chart + Placeholders */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">MTBF & Additional Metrics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#A0AEC0]" />
                    <h3 className="text-sm font-semibold text-white glow-text">
                      {mtbfChart.title}
                    </h3>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <RechartsBarChart data={mtbfChart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" opacity={0.3} />
                      <XAxis dataKey="name" tick={{fill: '#A0AEC0', fontSize: 10}} />
                      <YAxis 
                        tick={{fill: '#A0AEC0', fontSize: 10}} 
                        domain={[0, 500]} 
                        ticks={[0, 100, 200, 300, 400, 500]} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#2D3748', 
                          border: '1px solid #4A5568', 
                          borderRadius: '6px', 
                          color: '#E2E8F0' 
                        }}
                        formatter={(value, name, props) => [
                          props.payload.formattedValue, mtbfChart.title
                        ]}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#60A5FA" 
                        animationDuration={1000}
                        barSize={20}
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
                
                {["IMM", "SPM", "ASSY"].map((area, index) => (
                  <div 
                    key={`placeholder-${index}`}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift flex flex-col items-center justify-center"
                  >
                    <div className="text-[#4A5568] mb-2">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#A0AEC0] text-center">
                      {area} Additional Metrics
                    </h3>
                    <p className="text-xs text-[#718096] mt-2 text-center">
                      Placeholder for future KPIs
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4: Pie Charts */}
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white mb-4 glow-text">Breakdown Distribution</h2>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {pieCharts.slice(0, 4).map((chart, index) => (
                  <div
                    key={chart.key}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-[#A0AEC0]" />
                      <h3 className="text-sm font-semibold text-white glow-text">
                        {chart.title}
                      </h3>
                    </div>
                    {chart.data && chart.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <RechartsPieChart>
                          <Pie
                            data={chart.data}
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                            label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = outerRadius + 12;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);

                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="#E2E8F0"
                                  textAnchor={x > cx ? "start" : "end"}
                                  dominantBaseline="central"
                                  fontSize={10}
                                >
                                  {`${name && name.length > 12 ? name.substring(0, 12) + "…" : name || 'Unknown'} ${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                          >
                            {chart.data.map((entry, i) => (
                              <Cell
                                key={`cell-${i}`}
                                fill={COLORS[i % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, props) => [
                              `${value} ${chart.title.includes('Plant') ? 'min' : 'count'}`, 
                              props.payload.name || 'Unknown'
                            ]}
                            contentStyle={{
                              backgroundColor: '#2D3748',
                              border: '1px solid #4A5568',
                              borderRadius: '6px',
                              color: '#E2E8F0'
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] flex flex-col items-center justify-center">
                        <div className="text-[#4A5568] mb-2">
                          <PieChart className="w-8 h-8" />
                        </div>
                        <p className="text-xs text-[#718096] text-center">
                          No data available
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                
                {Array.from({ length: Math.max(0, 4 - pieCharts.length) }).map((_, index) => (
                  <div 
                    key={`pie-placeholder-${index}`}
                    className="bg-[#1A202C] border border-gray-700 rounded-lg p-4 glass-card hover-lift flex flex-col items-center justify-center"
                  >
                    <div className="text-[#4A5568] mb-2">
                      <PieChart className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#A0AEC0] text-center">
                      Additional Analysis
                    </h3>
                    <p className="text-xs text-[#718096] mt-2 text-center">
                      Placeholder for future data
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        {sheetData.length > 0 && (
          <div className="bg-[#1A202C] border border-gray-700 rounded-lg overflow-hidden glass-card">
            <div className="flex items-center justify-between px-4 py-3 bg-[#2D3748] border-b border-gray-700">
              <h3 className="text-sm font-medium text-[#E2E8F0]">
                Google Sheet Data ({sheetData.length} rows)
              </h3>
              <MoreHorizontal className="w-[18px] h-[18px] text-[#A0AEC0] hover:text-white cursor-pointer" />
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#2D3748]">
                  <tr>
                    {sheetData[0] &&
                      Object.keys(sheetData[0]).map((header, index) => (
                        <th
                          key={index}
                          className="px-4 py-3 text-left text-xs font-medium text-[#A0AEC0] uppercase tracking-wider border-b border-gray-700 whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`${
                        rowIndex % 2 === 0 ? "bg-[#1A202C]" : "bg-[#2D3748]"
                      } hover:bg-[#4A5568] transition-colors`}
                    >
                      {Object.values(row).map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-sm text-[#E2E8F0] border-b border-gray-700 whitespace-nowrap"
                        >
                          {cell || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && sheetData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-[#A0AEC0] animate-spin mb-4" />
            <p className="text-[#A0AEC0] text-sm">
              Loading data from Google Sheet...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sheetData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-[#2D3748] rounded-full flex items-center justify-center mb-4 glass-card">
              <BarChart3 className="w-8 h-8 text-[#A0AEC0]" />
            </div>
            <p className="text-[#A0AEC0] text-sm font-medium mb-2">No data available</p>
            <p className="text-[#A0AEC0] text-xs text-center max-w-md">
              No data was found in your Google Sheet. Please make sure your spreadsheet contains data and is properly configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveDataDashboard />
    </QueryClientProvider>
  );
}
